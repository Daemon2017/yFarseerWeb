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
let isExtended = false;
let dbSnpsList = [];

async function createMap() {
    let snpString;

    if (firstRun === true) {
        let queryString = window.location.search;
        let urlParams = new URLSearchParams(queryString);

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

        dbSnpsList = await getCollectionFromDb();

        $(function () {
            function split(val) {
                return val.split(/,\s*/);
            }

            function extractLast(term) {
                return split(term).pop();
            }

            $("#searchForm").on("keydown", function (event) {
                if (event.keyCode === $.ui.keyCode.TAB &&
                    $(this).autocomplete("instance").menu.active) {
                    event.preventDefault();
                }
            }).autocomplete({
                source: function (request, response) {
                    if (extractLast(request.term).length >= 3) {
                        let filteredSnpsList = dbSnpsList.filter(snp => snp.startsWith(extractLast(request.term.toUpperCase())))
                        let limitedSnpsList = filteredSnpsList.slice(0, 10);
                        response(limitedSnpsList);
                    }
                },
                focus: function () {
                    return false;
                },
                select: function (_event, ui) {
                    var terms = split(this.value);
                    terms.pop();
                    terms.push(ui.item.value);
                    terms.push("");
                    this.value = terms.join(",");
                    return false;
                }
            });
        });
    } else {
        clearAll();
        snpString = document.getElementById("searchForm").value;
    }

    let snpList = getSnpList(snpString, true);
    drawLayers(snpList, threshold);
}

async function setCheckboxState() {
    isExtended = document.getElementById('extendedCheckbox').checked;
    dbSnpsList = await getCollectionFromDb();
}

function setIntensity(thresholdValue) {
    threshold = thresholdValue === undefined ? threshold : 10 - thresholdValue;

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
    snpString = snpString.toUpperCase().replace(/ /g, "").replace(/\t/g, "");
    if (snpString === "") {
      let noSnpErrorText = "Error: No SNP was specified!";
      document.getElementById("stateLabel").innerText = noSnpErrorText;
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
    } else {
        maxLength = 25;
    }

    if (!(snpList.length > 0 && snpList.length <= maxLength)) {
        let wrongSnpLengthErrorText = `Error: The number of SNPs should be in the range [1;${maxLength}]!`;
        document.getElementById("stateLabel").innerText = wrongSnpLengthErrorText;
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
                let data = await getDocFromDb(snp);
                let gradient = {};
                gradientKeys.forEach(function (_key, j) {
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
            } catch (e) {
                errorSnpList.push(snp);
            }
        }

        printState(errorSnpList, snpList);
    }
}

async function getDocFromDb(snp) {
    let db = firebase.firestore();
    let docRef = isExtended ? db.collection("snps_extended").doc(snp) : db.collection("snps").doc(snp);
    let doc = await docRef.get();
    let data = JSON.parse(doc.data().data);
    return data;
}

async function getCollectionFromDb() {
    let db = firebase.firestore();
    let collectionRef = isExtended ? db.collection("snps_extended") : db.collection("snps");
    let collection = await collectionRef.get();
    let data = collection.docs.map(doc => doc.id);
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
    try {
        let lat = Number(document.getElementById("latForm").value);
        let lng = Number(document.getElementById("lngForm").value);
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

function getArrayMax(myArray, n, property) {
    return Math.max.apply(Math, myArray[n].map(function (o) {
        return o[property];
    }));
}

async function getCorrelation() {
    let snpString = document.getElementById("searchForm").value;
    let snpList = getSnpList(snpString, false);

    let snpPointsList = [];
    if (snpList !== undefined) {
        let errorSnpList = [];
        let i = 0;
        for (const snp of snpList) {
            try {
                let data = await getDocFromDb(snp);
                snpPointsList.push(data);
                i++;
            } catch (e) {
                errorSnpList.push(snp);
            }
        }

        let correlationMatrix = [];
        snpPointsList.forEach(function (snpPointsA, a) {
            let aDict = {};
            let aMax = getArrayMax(snpPointsList, a, "count");
            snpPointsA.forEach(function (point) {
                aDict[`${point["lat"]};${point["lng"]}`] = point["count"] / aMax;
            });

            let correlationRow = [];
            snpPointsList.forEach(function (snpPointsB, b) {
                let bDict = {};
                let bMax = getArrayMax(snpPointsList, b, "count");
                snpPointsB.forEach(function (point) {
                    bDict[`${point["lat"]};${point["lng"]}`] = point["count"] / bMax;
                });

                let allPossibleKeysList = Object.keys(aDict).concat(Object.keys(bDict));
                allPossibleKeysList = Array.from(new Set(allPossibleKeysList));
                allPossibleKeysList = allPossibleKeysList.sort();

                let countListList = [];
                new Array(aDict, bDict).forEach(function (dict) {
                    let countList = new Array(allPossibleKeysList.length).fill(0);
                    allPossibleKeysList.forEach(function (key, index) {
                        countList[index] = dict[key] == undefined ? 0 : dict[key];
                    });
                    countListList.push(countList);
                });

                correlationRow.push(jStat
                    .corrcoeff(countListList[0], countListList[1])
                    .toFixed(2)
                );
            });
            correlationMatrix.push(correlationRow);
        })

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
            row.forEach(function (_column, j) {
                result += `<th>${successSnpList[j]}</th>`;
            });
            result += "</tr>";
            result += "<tr>";
        }
        row.forEach(function (column, j) {
            if (j === 0) {
                result += `<td>${successSnpList[i]}</td>`;
            }
            result += `<td class="${getCorrelationClass(column)}">` + column + "</td>";
        });
        result += "</tr>";
    });
    result += "</table>";
    return result;
}

function getCorrelationClass(correlationValue) {
    if (correlationValue < -0.90) {
        return "veryHighNeg";
    } else if (correlationValue >= -0.90 && correlationValue < -0.70) {
        return "highNeg";
    } else if (correlationValue >= -0.70 && correlationValue < -0.50) {
        return "modNeg";
    } else if (correlationValue >= -0.50 && correlationValue < -0.30) {
        return "lowNeg";
    } else if (correlationValue >= -0.30 && correlationValue < 0) {
        return "veryLowNeg";
    } else if (correlationValue >= 0 && correlationValue <= 0.30) {
        return "veryLowPos";
    } else if (correlationValue > 0.30 && correlationValue <= 0.50) {
        return "lowPos";
    } else if (correlationValue > 0.50 && correlationValue <= 0.70) {
        return "modPos";
    } else if (correlationValue > 0.70 && correlationValue <= 0.90) {
        return "highPos";
    } else if (correlationValue > 0.90) {
        return "veryHighPos";
    }
}