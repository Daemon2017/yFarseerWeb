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

let map;
let baseLayer;
let threshold = 5;
let firstRun = true;

function createMap() {
    firebase.analytics().logEvent("MapCreationStarted");

    let queryString = window.location.search;
    let urlParams = new URLSearchParams(queryString);

    let snpString;

    if (firstRun === true) {
        let lat = urlParams.get("lat") == null ? 48.814170 : urlParams.get("lat");
        let lng = urlParams.get("lng") == null ? 23.169720 : urlParams.get("lng");
        document.getElementById("latForm").value = lat;
        document.getElementById("lngForm").value = lng;

        let zoom = urlParams.get("zoom") == null ? 4 : urlParams.get("zoom");

        threshold = urlParams.get("threshold") == null ? 5 : 10 - urlParams.get("threshold");
        document.getElementById("maxCountSlider").value = null ? 5 : urlParams.get("threshold")

        baseLayer = L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: 'Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://cloudmade.com">CloudMade</a>',
                maxZoom: 10,
            }
        );

        map = new L.Map("mapLayer", {
            center: new L.LatLng(lat, lng),
            zoom: zoom,
            layers: [baseLayer],
        });

        map.addEventListener("move", getLatLng());
        firstRun = false;

        snpString = urlParams.get("snps");
    } else {
        clearAll();

        snpString = document.getElementById("searchForm").value;
    }

    let snpList = getSnpList(snpString, true);
    drawLayers(snpList, threshold);
}

function setIntensity(thresholdValue) {
    firebase.analytics().logEvent("IntensitySettingStarted");

    threshold = thresholdValue === undefined ? threshold : 10 - thresholdValue;

    firebase.analytics().logEvent("IntensitySetted", {
        "thresholdValue": thresholdValue
    });

    map.eachLayer(function (oldLayer) {
        if (oldLayer !== baseLayer) {
            let data = [];
            oldLayer._data.forEach(d => {
                let point = {
                    lat: d.latlng.lat,
                    lng: d.latlng.lng,
                    count: d.count
                };
                data.push(point);
            });

            let gradient = oldLayer._heatmap._config.gradient;

            let heatmapCfg = {
                radius: 3,
                maxOpacity: 0.9,
                minOpacity: 0.1,
                scaleRadius: true,
                useLocalExtrema: false,
                latField: "lat",
                lngField: "lng",
                valueField: "count",
                gradient: gradient,
            };

            let newLayer = new HeatmapOverlay(heatmapCfg);
            newLayer.setData({
                max: threshold,
                data: data,
            });
            map.removeLayer(oldLayer);
            map.addLayer(newLayer);
        }
    });
}

function clearAll() {
    firebase.analytics().logEvent("ClearingStarted");

    for (let i = 0; i < 10; i++) {
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

function getSnpList(snpString, isForDraw) {
    snpString = snpString.toUpperCase().replace(/ /g, "");
    if (snpString === "") {
        let noSnpErrorText = "Error: No SNP was specified!";
        document.getElementById("stateLabel").innerText = noSnpErrorText;
        firebase.analytics().logEvent("NoSnpSpecified");
        throw noSnpErrorText;
    }

    let snpList = snpString.split(",");
    snpList = snpList.filter(function (snp) {
        return snp !== "";
    });
    document.getElementById("searchForm").value = snpList.join(",");

    let maxLength;
    if (isForDraw) {
        maxLength = 10;
        firebase.analytics().logEvent("SnpNumberSpecifiedDraw", {
            "SnpNumber": snpList.length
        });
    } else {
        maxLength = 25;
        firebase.analytics().logEvent("SnpNumberSpecifiedCorrelation", {
            "SnpNumber": snpList.length
        });
    }

    if (!(snpList.length > 0 && snpList.length <= maxLength)) {
        let wrongSnpLengthErrorText = `Error: The number of SNPs should be in the range [1;${maxLength}]!`;
        document.getElementById("stateLabel").innerText = wrongSnpLengthErrorText;
        firebase.analytics().logEvent("WrongSnpNumberSpecified", {
            "SnpNumber": snpList.length
        });
        throw wrongSnpLengthErrorText;
    }

    return snpList;
}

async function drawLayers(snpList, thresholdValue) {
    if (snpList !== undefined) {
        let errorSnpList = [];
        let i = 0;
        for (const snp of snpList) {
            try {
                let data = await getDataFromDb(snp);

                let gradient = {};
                gradientKeys.forEach(function (key, j) {
                    gradient[gradientKeys[j]] = gradientValues[i][j];
                });

                let heatmapCfg = {
                    radius: 3,
                    maxOpacity: 0.9,
                    minOpacity: 0.1,
                    scaleRadius: true,
                    useLocalExtrema: false,
                    latField: "lat",
                    lngField: "lng",
                    valueField: "count",
                    gradient: gradient,
                };

                let heatmapLayer = new HeatmapOverlay(heatmapCfg);
                heatmapLayer.setData({
                    max: thresholdValue,
                    data: data,
                });
                map.addLayer(heatmapLayer);

                document.getElementById(`cb${i}`).style =
                    `background-color:${gradientValues[i][9]}`;
                i++;
                firebase.analytics().logEvent("SnpReceived", {
                    "SnpName": snp
                });
            } catch (e) {
                errorSnpList.push(snp);
                firebase.analytics().logEvent("SnpNotReceived", {
                    "SnpName": snp
                });
            }
        }

        printState(errorSnpList, snpList);
    }
}

async function getDataFromDb(snp) {
    let db = firebase.firestore();
    let snpRef = db.collection("snps").doc(snp);
    let snpDoc = await snpRef.get();
    let data = JSON.parse(snpDoc.data().data);
    return data;
}

function getLatLng() {
    return function () {
        let center = map.getCenter();
        let lat = center.lat;
        let lng = center.lng;
        document.getElementById("latForm").value = lat;
        document.getElementById("lngForm").value = lng;
    };
}

function setLatLng() {
    firebase.analytics().logEvent("LatLngSettingStarted");

    try {
        let lat = Number(document.getElementById("latForm").value);
        let lng = Number(document.getElementById("lngForm").value);
        map.panTo(new L.LatLng(lat, lng));
        document.getElementById("stateLabel").innerText = "OK.";
        firebase.analytics().logEvent("LatLngSettingOk", {
            "lat": lat,
            "lng": lng
        });
    } catch (e) {
        document.getElementById("stateLabel").innerText =
            "Error: Both Lat and Lng must be a number!";
        firebase.analytics().logEvent("LatLngSettingError", {
            "lat": lat,
            "lng": lng
        });
    }
}

function printState(errorSnpList, snpList) {
    if (errorSnpList.length === 0) {
        document.getElementById("stateLabel").innerText = "OK.";
    } else if (snpList.length - errorSnpList.length === 0) {
        document.getElementById("searchForm").value = snpList.filter(function (snp) {
            return !errorSnpList.includes(snp);
        }).join(",");
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
    firebase.analytics().logEvent("CorrelationGettingStarted");

    let snpString = document.getElementById("searchForm").value;
    let snpList = getSnpList(snpString, false);

    let snpPointsList = [];
    if (snpList !== undefined) {
        let errorSnpList = [];
        let i = 0;
        for (const snp of snpList) {
            try {
                let data = await getDataFromDb(snp);

                snpPointsList.push(data);
                i++;
                firebase.analytics().logEvent("CorrelSnpReceived", {
                    "SnpName": snp
                });
            } catch (e) {
                errorSnpList.push(snp);
                firebase.analytics().logEvent("CorrelSnpNotReceived", {
                    "SnpName": snp
                });
            }
        }

        let allPossibleKeysList = [];
        snpPointsList.forEach(function (snpPoints) {
            snpPoints.forEach(function (point) {
                allPossibleKeysList.push(`${point["lat"]};${point["lng"]}`);
            });
        });
        allPossibleKeysList = Array.from(new Set(allPossibleKeysList));
        allPossibleKeysList = allPossibleKeysList.sort();

        let countListList = [];
        snpPointsList.forEach(function (snpPoints) {
            let countList = new Array(allPossibleKeysList.length).fill(0);
            snpPoints.forEach(function (point) {
                countList[allPossibleKeysList.indexOf(`${point["lat"]};${point["lng"]}`)] = point["count"];
            });
            countListList.push(countList);
        });

        let correlationMatrix = [];
        for (let a = 0; a < snpPointsList.length; a++) {
            let correlationRow = [];
            for (let b = 0; b < snpPointsList.length; b++) {
                correlationRow.push(jStat
                    .corrcoeff(countListList[a], countListList[b])
                    .toFixed(2)
                );
            }
            correlationMatrix.push(correlationRow);
        }

        let successSnpList = snpList.filter(function (snp) {
            return !errorSnpList.includes(snp);
        });
        if (successSnpList.length > 0) {
            document.getElementById("correlationMatrix").innerHTML = getHtmlTable(correlationMatrix, successSnpList);
        }

        printState(errorSnpList, snpList);
    }
}

function getHtmlTable(myArray, successSnpList) {
    let result =
        "<table id='correlTable'><caption>Correlation matrix:</caption>";
    myArray.forEach(function (row, i) {
        result += "<tr>";
        if (i === 0) {
            result += "<th>" + "</th>";
            row.forEach(function (column, j) {
                result += `<th>${successSnpList[j]}</th>`;
            });
            result += "</tr>";
            result += "<tr>";
        }
        row.forEach(function (column, j) {
            if (j === 0) {
                result += `<td>${successSnpList[i]}</td>`;
            }
            result += "<td>" + column + "</td>";
        });
        result += "</tr>";
    });
    result += "</table>";
    return result;
}