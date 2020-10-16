const gradientKeys = [
    ".10",
    ".20",
    ".30",
    ".40",
    ".50",
    ".60",
    ".70",
    ".80",
    ".90",
    "1.",
];
const gradientValues = [
    [
        "#F9EBEA",
        "#F2D7D5",
        "#E6B0AA",
        "#D98880",
        "#CD6155",
        "#C0392B",
        "#A93226",
        "#922B21",
        "#7B241C",
        "#641E16",
    ],
    [
        "#F4ECF7",
        "#E8DAEF",
        "#D2B4DE",
        "#BB8FCE",
        "#A569BD",
        "#8E44AD",
        "#7D3C98",
        "#6C3483",
        "#5B2C6F",
        "#4A235A",
    ],
    [
        "#EAF2F8",
        "#D4E6F1",
        "#A9CCE3",
        "#7FB3D5",
        "#5499C7",
        "#2980B9",
        "#2471A3",
        "#1F618D",
        "#1A5276",
        "#154360",
    ],
    [
        "#E8F6F3",
        "#D0ECE7",
        "#A2D9CE",
        "#73C6B6",
        "#45B39D",
        "#16A085",
        "#138D75",
        "#117A65",
        "#0E6655",
        "#0B5345",
    ],
    [
        "#E9F7EF",
        "#D4EFDF",
        "#A9DFBF",
        "#7DCEA0",
        "#52BE80",
        "#27AE60",
        "#229954",
        "#1E8449",
        "#196F3D",
        "#145A32",
    ],
    [
        "#FEF5E7",
        "#FDEBD0",
        "#FAD7A0",
        "#F8C471",
        "#F5B041",
        "#F39C12",
        "#D68910",
        "#B9770E",
        "#9C640C",
        "#7E5109",
    ],
    [
        "#FBEEE6",
        "#F6DDCC",
        "#EDBB99",
        "#E59866",
        "#DC7633",
        "#D35400",
        "#BA4A00",
        "#A04000",
        "#873600",
        "#6E2C00",
    ],
    [
        "#F8F9F9",
        "#F2F3F4",
        "#E5E7E9",
        "#D7DBDD",
        "#CACFD2",
        "#BDC3C7",
        "#A6ACAF",
        "#909497",
        "#797D7F",
        "#626567",
    ],
    [
        "#F2F4F4",
        "#E5E8E8",
        "#CCD1D1",
        "#B2BABB",
        "#99A3A4",
        "#7F8C8D",
        "#707B7C",
        "#616A6B",
        "#515A5A",
        "#424949",
    ],
    [
        "#EAECEE",
        "#D5D8DC",
        "#ABB2B9",
        "#808B96",
        "#566573",
        "#2C3E50",
        "#273746",
        "#212F3D",
        "#1C2833",
        "#17202A",
    ],
];

var map;
var baseLayer;

function createMap() {
    var queryString = window.location.search;
    var urlParams = new URLSearchParams(queryString);
    var lat = urlParams.get("lat") == null ? 25.6586 : urlParams.get("lat");
    var lng = urlParams.get("lng") == null ? -80.3568 : urlParams.get("lng");
    document.getElementById("latForm").value = lat;
    document.getElementById("lngForm").value = lng;

    baseLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution:
                'Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://cloudmade.com">CloudMade</a>',
            maxZoom: 10,
        }
    );

    map = new L.Map("mapLayer", {
        center: new L.LatLng(lat, lng),
        zoom: 4,
        layers: [baseLayer],
    });

    map.addEventListener("move", getLatLng());

    var snpString = urlParams.get("snps");
    var snpList = getSnpList(snpString);
    drawMap(snpList, 10);
}

var threshold = 10;

function buildMap(newThreshold) {
    threshold = newThreshold === undefined ? threshold : 10 - newThreshold;
    clearMap();
    var snpString = document.getElementById("searchForm").value;
    var snpList = getSnpList(snpString);
    drawMap(snpList, threshold);
}

function clearMap() {
    for (var i = 0; i < 10; i++) {
        document.getElementById(`cb${i}`).style =
            "background-color: transparent";
    }

    document.getElementById("correlationMatrix").innerHTML = null;

    map.eachLayer(function (layer) {
        if (layer !== baseLayer) {
            map.removeLayer(layer);
        }
    });

    document.getElementById("stateLabel").innerText = "OK.";
}

function getSnpList(snpString) {
    if (snpString != null) {
        snpString = snpString.toUpperCase().replace(/ /g, "");
        if (snpString === "") {
            document.getElementById("stateLabel").innerText =
                "Error: No SNP was specified!";
            throw "Error!";
        }

        var snpList = snpString.split(",");
        snpList = snpList.filter(function (snp) {
            return snp !== "";
        });
        document.getElementById("searchForm").value = snpList.join(",");

        if (!(snpList.length > 0 && snpList.length < 10)) {
            document.getElementById("stateLabel").innerText =
                "Error: The number of SNPs should be in the range [1;10]!";
            throw "Error!";
        }

        return snpList;
    }
}

// TODO: при быстром изменении интенсивности, в map попадают старые слои - надо разобраться.
async function drawMap(snpList, thresholdValue) {
    if (snpList !== undefined) {
        var errorSnpList = [];
        var i = 0;
        for (const snp of snpList) {
            try {
                let response = await fetch(`http://127.0.0.1:8080/snpData/${snp}`);
                let data = await response.json();

                var heatmapLayerData = {
                    max: thresholdValue,
                    data: data,
                };

                var gradient = {};
                gradientKeys.forEach(function (key, j) {
                    gradient[gradientKeys[j]] = gradientValues[i][j];
                });

                var heatmapCfg = {
                    radius: 2,
                    maxOpacity: 0.9,
                    minOpacity: 0.1,
                    scaleRadius: true,
                    useLocalExtrema: false,
                    latField: "lat",
                    lngField: "lng",
                    valueField: "count",
                    gradient: gradient,
                };

                var heatmapLayer = new HeatmapOverlay(heatmapCfg);
                heatmapLayer.setData(heatmapLayerData);
                map.addLayer(heatmapLayer);

                document.getElementById(`cb${i}`).style =
                    `background-color:${gradientValues[i][9]}`;
                i++;
            } catch (e) {
                errorSnpList.push(snp);
            }
        }

        printState(errorSnpList, snpList);
    }
}

function getLatLng() {
    return function () {
        var center = map.getCenter();
        var lat = center.lat;
        var lng = center.lng;
        document.getElementById("latForm").value = lat;
        document.getElementById("lngForm").value = lng;
    };
}

function setLatLng() {
    try {
        var lat = Number(document.getElementById("latForm").value);
        var lng = Number(document.getElementById("lngForm").value);
        map.panTo(new L.LatLng(lat, lng));
        document.getElementById("stateLabel").innerText = "OK.";
    } catch (e) {
        document.getElementById("stateLabel").innerText =
            "Error: Both Lat and Lng must be a number!";
    }
}

function printState(errorSnpList, snpList) {
    if (errorSnpList.length === 0) {
        document.getElementById("stateLabel").innerText = "OK.";
    } else if (snpList.length - errorSnpList.length === 0) {
        document.getElementById("stateLabel").innerText =
            `Error: Data of all SNPs wasn't received!`;
    } else {
        document.getElementById("searchForm").value = snpList.filter(function (snp) {
            return !errorSnpList.includes(snp);
        }).join(",");
        document.getElementById("stateLabel").innerText =
            `Error: Data of SNPs ${errorSnpList.join(",")} wasn't received!`;
    }
}

async function getCorrelation() {
    var snpString = document.getElementById("searchForm").value;
    var snpList = getSnpList(snpString);

    var snpPointsList = [];
    if (snpList !== undefined) {
        var errorSnpList = [];
        var i = 0;
        for (const snp of snpList) {
            try {
                let response = await fetch(`http://127.0.0.1:8080/snpData/${snp}`);
                let data = await response.json();
                snpPointsList.push(data);
                i++;
            } catch (e) {
                errorSnpList.push(snp);
            }
        }

        var allPossibleKeysList = [];
        snpPointsList.forEach(function (snpPoints) {
            snpPoints.forEach(function (point) {
                allPossibleKeysList.push(`${point["lat"]};${point["lng"]}`);
            });
        });
        allPossibleKeysList = Array.from(new Set(allPossibleKeysList));
        allPossibleKeysList = allPossibleKeysList.sort();

        var countListList = [];
        snpPointsList.forEach(function (snpPoints) {
            var countList = new Array(allPossibleKeysList.length).fill(0);
            snpPoints.forEach(function (point) {
                countList[allPossibleKeysList.indexOf(`${point["lat"]};${point["lng"]}`)] = point["count"];
            });
            countListList.push(countList);
        });

        var correlationMatrix = [];
        for (var a = 0; a < snpPointsList.length; a++) {
            var correlationRow = [];
            for (var b = 0; b < snpPointsList.length; b++) {
                correlationRow.push(jStat
                    .corrcoeff(countListList[a], countListList[b])
                    .toFixed(2)
                );
            }
            correlationMatrix.push(correlationRow);
        }

        if (snpList.length - errorSnpList.length > 0) {
            document.getElementById("correlationMatrix").innerHTML = getHtmlTable(correlationMatrix);
        }
        printState(errorSnpList, snpList);
    }
}

// TODO: в заголовках должны быть имена SNP.
function getHtmlTable(myArray) {
    var result =
        "<table id='correlTable'><caption>Correlation matrix:</caption>";
    myArray.forEach(function (row, i) {
        result += "<tr>";
        if (i === 0) {
            result += "<th>" + "</th>";
            row.forEach(function (column, j) {
                result += `<th>SNP#${j}</th>`;
            });
            result += "</tr>";
            result += "<tr>";
        }
        row.forEach(function (column, j) {
            if (j === 0) {
                result += `<td>SNP#${i}</td>`;
            }
            result += "<td>" + column + "</td>";
        });
        result += "</tr>";
    });
    result += "</table>";
    return result;
}
