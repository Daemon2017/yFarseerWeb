const LAT_URL_PARAM = "lat";
const LNG_URL_PARAM = "lng";
const ZOOM_URL_PARAM = "zoom";
const ISEXTENDED_URL_PARAM = "isExtended";
const THRESHOLD_URL_PARAM = "threshold";
const SNPS_URL_PARAM = "snps";
const MODE_URL_PARAM = "mode";

const LAT_FORM_ELEMENT_ID = "latForm";
const LNG_FORM_ELEMENT_ID = "lngForm";
const EXTENDED_CHECKBOX_ELEMENT_ID = "extendedCheckbox";
const INTENSITY_SLIDER_ELEMENT_ID = "intensitySlider";
const SEARCH_FORM_ELEMENT_ID = "searchForm";
const CORRELATION_MATRIX_ELEMENT_ID = "correlationMatrix";
const STATE_LABEL_ELEMENT_ID = "stateLabel";
const BOXES_ELEMENT_ID = "boxes";

const BUSY_STATE_TEXT = "Busy...";
const OK_STATE_TEXT = "OK.";

const colorBoxesNumber = 20;

let map;
let baseLayer;
let dbSnpsList = [];
let mode;
let gradientValues = [];
let uncheckedSnpsList = [];
let currentSnpList = [];

const Modes = Object.freeze({
    LEVELS_MODE: String("levels"),
    DISPERSION_MODE: String("dispersion"),
    CORRELATION_ALL_MODE: String("correlationAll"),
    CORRELATION_INTERSECT_MODE: String("correlationIntersect")
});

async function main() {
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;

    gradientValues = createGradientList();

    let colorBoxesInnerHtml =  ``;
    for (let i = 0; i < colorBoxesNumber; i++) {
        colorBoxesInnerHtml += 
        `<span class="colorBox tooltip" id="colorBox${i}">
            <input type="checkbox" class="checkBox" id="checkBox${i}" onclick="updateUncheckedList(${i})"/>
            <label class="checkBoxLabel" id="checkBoxLabel${i}" for="checkBox${i}"></label>
        </span>`;
    }
    document.getElementById(BOXES_ELEMENT_ID).innerHTML = colorBoxesInnerHtml;

    let queryString = window.location.search;
    let urlParams = new URLSearchParams(queryString);
    let lat = urlParams.get(LAT_URL_PARAM) == null ? 48.814170 : urlParams.get(LAT_URL_PARAM);
    document.getElementById(LAT_FORM_ELEMENT_ID).value = lat;
    let lng = urlParams.get(LNG_URL_PARAM) == null ? 23.169720 : urlParams.get(LNG_URL_PARAM);
    document.getElementById(LNG_FORM_ELEMENT_ID).value = lng;
    let zoom = urlParams.get(ZOOM_URL_PARAM) == null ? 4 : urlParams.get(ZOOM_URL_PARAM);
    document.getElementById(EXTENDED_CHECKBOX_ELEMENT_ID).checked = urlParams.get(ISEXTENDED_URL_PARAM) == "true" ? true : false;
    document.getElementById(INTENSITY_SLIDER_ELEMENT_ID).value = urlParams.get(THRESHOLD_URL_PARAM) == null ? 5 : urlParams.get(THRESHOLD_URL_PARAM);
    let snpString = urlParams.get(SNPS_URL_PARAM);
    mode = urlParams.get(MODE_URL_PARAM);

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

    dbSnpsList = await getDocFromDb("list");

    attachDropDownPrompt();

    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = OK_STATE_TEXT;

    selectAction(snpString);
}

function createGradientList() {
    let lastColorList = [
        "#e6194B", 
        "#3cb44b", 
        "#ffe119", 
        "#4363d8", 
        "#f58231", 
        "#911eb4", 
        "#42d4f4", 
        "#f032e6", 
        "#bfef45", 
        "#fabed4", 
        "#469990", 
        "#dcbeff", 
        "#9A6324", 
        "#fffac8", 
        "#800000", 
        "#aaffc3", 
        "#808000", 
        "#ffd8b1", 
        "#000075", 
        "#a9a9a9"
    ];
    let gradientList = [];
    for (let i = 0; i < colorBoxesNumber; i++) {
        let numberOfItems = 10;
        let rainbow = new Rainbow();
        rainbow.setNumberRange(1, numberOfItems);
        rainbow.setSpectrum("#FFFFFF", lastColorList[i]);
        let gradient = [];
        for (let j = 1; j <= numberOfItems; j++) {
            gradient.push("#" + rainbow.colourAt(j));
        }
        gradientList.push(gradient);
    }
    return gradientList;
}

function attachDropDownPrompt() {
    $(function () {
        function split(val) {
            return val.split(/,\s*/);
        }

        function extractLast(term) {
            return split(term).pop();
        }

        $("#searchForm").on("keydown", function (event) {
            if (event.keyCode === $.ui.keyCode.TAB && $(this).autocomplete("instance").menu.active) {
                event.preventDefault();
            }
        }).autocomplete({
            source: function (request, response) {
                let filteredSnpsList = dbSnpsList.filter(snp => snp.startsWith(extractLast(request.term.toUpperCase())));
                let limitedSnpsList = filteredSnpsList.slice(0, colorBoxesNumber);
                response(limitedSnpsList);
            },
            search: function (_event, _ui) {
                if (extractLast(this.value).length <= 2) {
                    return false;
                }
            },
            focus: function (_event, _ui) {
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
}

function selectAction(snpString) {
    if (mode === Modes.LEVELS_MODE) {
        showMap(false, snpString);
    } else if (mode === Modes.DISPERSION_MODE) {
        showMap(true, snpString);
    } else if (mode === Modes.CORRELATION_INTERSECT_MODE) {
        showCorrelation(false, snpString);
    } else if (mode === Modes.CORRELATION_ALL_MODE) {
        showCorrelation(true, snpString);
    }
}

async function showMap(isDispersion, snpString) {
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;

    if (isDispersion === true) {
        mode = Modes.DISPERSION_MODE;
    } else {
        mode = Modes.LEVELS_MODE;
    }

    clearAll(false);
    if (snpString === null | snpString === undefined) {
        snpString = document.getElementById(SEARCH_FORM_ELEMENT_ID).value;
    }

    currentSnpList = getSnpList(snpString);
    let threshold = 10 - document.getElementById(INTENSITY_SLIDER_ELEMENT_ID).value;
    drawLayers(currentSnpList, threshold);
}

async function updateExtendedState() {
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;
    dbSnpsList = await getDocFromDb("list");
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = OK_STATE_TEXT;
}

function updateIntensity(intensity) {
    let threshold = 10 - intensity;
    drawLayers(currentSnpList, threshold);
}

function updateUncheckedList(i){
    if (document.getElementById(`checkBox${i}`).checked === true) {
        uncheckedSnpsList = uncheckedSnpsList.filter(item => item !== i);
    } else {
        uncheckedSnpsList.push(i);
    }
    drawLayers(currentSnpList, 10 - document.getElementById(INTENSITY_SLIDER_ELEMENT_ID).value);
}

function clearAll(isClearButtonPressed) {
    if (isClearButtonPressed) {
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;
    }
    for (let i = 0; i < colorBoxesNumber; i++) {
        document.getElementById(`checkBoxLabel${i}`).style = "background-color: transparent";
        document.getElementById(`checkBoxLabel${i}`).innerHTML = null;
        document.getElementById(`checkBox${i}`).checked = false;
    }
    uncheckedSnpsList = [];
    document.getElementById(CORRELATION_MATRIX_ELEMENT_ID).innerHTML = null;
    map = getCleanMap();
    if (isClearButtonPressed) {
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = OK_STATE_TEXT;
    }
}

function getCleanMap() {
    let newMap = map;
    newMap.eachLayer(function (layer) {
        if (layer !== baseLayer) {
            newMap.removeLayer(layer);
        }
    });
    return newMap;
}

function getSnpList(snpString) {
    if (snpString !== null) {
        snpString = snpString.toUpperCase().replace(/ /g, "").replace(/\t/g, "");
        if (snpString === "") {
            let noSnpErrorText = "Error: No SNP was specified!";
            document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = noSnpErrorText;
            throw noSnpErrorText;
        }

        let snpList = snpString.split(",");
        snpList = snpList.filter(function (snp) {
            return snp !== "";
        });
        document.getElementById(SEARCH_FORM_ELEMENT_ID).value = snpList.join(",");

        let maxLength;
        if (mode === Modes.DISPERSION_MODE) {
            maxLength = 1;
        } else if (mode === Modes.LEVELS_MODE) {
            maxLength = colorBoxesNumber;
        } else if (mode === Modes.CORRELATION_ALL_MODE || mode === Modes.CORRELATION_INTERSECT_MODE) {
            maxLength = 50;
        } 

        if (!(snpList.length > 0 && snpList.length <= maxLength)) {
            let wrongSnpLengthErrorText = `Error: The number of SNPs should be in the range [1;${maxLength}]!`;
            document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = wrongSnpLengthErrorText;
            throw wrongSnpLengthErrorText;
        }

        return snpList;
    }
}

async function drawLayers(snpList, threshold) {
    let heatmapCfg = {
        blur: 0.85,
        minOpacity: 0.1,
        scaleRadius: true,
        useLocalExtrema: false,
        latField: "lat",
        lngField: "lng",
        valueField: "count",
        radius: 2,
        maxOpacity: 0.5
    };

    if (snpList !== undefined) {
        let errorSnpList = [];
        let dataList = [];
        for (const snp of snpList) {
            try {
                let data = await getDocFromDb(snp);
                dataList.push(data);
            } catch (e) {
                errorSnpList.push(snp);
            }
        }
        let newMap = getCleanMap();
        for (let i = 0; i < snpList.length; i++) {
            if (dataList[i] !== undefined) {
                if (mode === Modes.DISPERSION_MODE) {
                    newMap = drawDispersionLayers(dataList, i, newMap, heatmapCfg, threshold);
                } else if (mode === Modes.LEVELS_MODE) {
                    newMap = drawLevelsLayers(i, newMap, heatmapCfg, dataList, threshold, snpList);
                }
            }
        }
        map = newMap;
        printSnpReceivingState(errorSnpList, snpList);
    }
}

function drawDispersionLayers(dataList, i, newMap, heatmapCfg, threshold) {
    let snpCombinationsList = getSnpCombinationsList(dataList[i]);
    if (snpCombinationsList.length <= colorBoxesNumber) {
        let pointGroupsList = getPointGroupsList(snpCombinationsList, dataList[i]);
        for (let j = 0; j < snpCombinationsList.length; j++) {
            if (!uncheckedSnpsList.includes(i)) {
                newMap = getMapWithNewLayer(heatmapCfg, j, pointGroupsList[j], threshold, newMap);
                updateCheckbox(j, snpCombinationsList[j].join(","));
            }
        }
    } else {
        let tooMuchDispersionGroupsErrorText = `Error: Selected SNP has more than the maximum allowed (${colorBoxesNumber}) number of dispersion groups :(`;
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = tooMuchDispersionGroupsErrorText;
        throw tooMuchDispersionGroupsErrorText;
    }
    return newMap;
}

function drawLevelsLayers(i, newMap, heatmapCfg, dataList, threshold, snpList) {
    if (!uncheckedSnpsList.includes(i)) {
        newMap = getMapWithNewLayer(heatmapCfg, i, dataList[i], threshold, newMap);
        updateCheckbox(i, snpList[i]);
    }
    return newMap;
}

function getMapWithNewLayer(heatmapCfg, i, data, threshold, newMap) {
    heatmapCfg["gradient"] = getGradient(i);
    let newLayer = new HeatmapOverlay(heatmapCfg);
    if (mode === Modes.DISPERSION_MODE) {
        let newData = [];
        data.forEach(element => {
            newData.push({
                "count": 1,
                "lat": element["lat"],
                "lng": element["lng"],
                "snpsList": element["snpsList"]
            });
        });
        data = newData;
    }
    newLayer.setData({
        max: threshold,
        data: data,
    });
    newMap.addLayer(newLayer);
    return newMap;
}

function updateCheckbox(i, tooltipText) {
    document.getElementById(`checkBoxLabel${i}`).style = `background-color:${gradientValues[i][6]}`;
    document.getElementById(`checkBox${i}`).checked = true;
    document.getElementById(`checkBoxLabel${i}`).innerHTML = `<span class="tooltiptext" id="tooltipText${i}">${tooltipText}</span>`;
}

function getGradient(i) {
    let gradientKeys = [
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
    let gradient = [];
    gradientKeys.forEach(function (_key, j) {
        gradient[gradientKeys[j]] = gradientValues[i][j];
    });
    return gradient;
}

function getPointGroupsList(snpCombinationsList, data) {
    let pointGroupsList = [];
    for (const snpCombination of snpCombinationsList) {
        let pointGroup = [];
        for (const point of data) {
            if (point["snpsList"].toString() === snpCombination.toString()) {
                pointGroup.push(point);
            }
        }
        pointGroupsList.push(pointGroup);
    }
    return pointGroupsList;
}

function getSnpCombinationsList(data) {
    let snpCombinationsList = [];
    for (const point of data) {
        snpCombinationsList.push(point["snpsList"]);
    }
    snpCombinationsList = Array.from(new Set(snpCombinationsList.map(JSON.stringify)), JSON.parse);
    return snpCombinationsList;
}

async function getDocFromDb(snp) {
    let db = firebase.firestore();
    let docRef = document.getElementById(EXTENDED_CHECKBOX_ELEMENT_ID).checked ? db.collection("new_snps_extended").doc(snp) : db.collection("new_snps").doc(snp);
    let doc = await docRef.get();
    return JSON.parse(doc.data().data);
}

function getLatLng() {
    return function () {
        let center = map.getCenter();
        let lat = center.lat;
        let lng = center.lng;
        document.getElementById(LAT_FORM_ELEMENT_ID).value = lat;
        document.getElementById(LNG_FORM_ELEMENT_ID).value = lng;
    };
}

function setLatLng() {
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;
    try {
        let lat = Number(document.getElementById(LAT_FORM_ELEMENT_ID).value);
        let lng = Number(document.getElementById(LNG_FORM_ELEMENT_ID).value);
        map.panTo(new L.LatLng(lat, lng));
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = OK_STATE_TEXT;
    } catch (e) {
        let latAndLngMustBeANumberErrorText = "Error: Both Lat and Lng must be a number!";
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = latAndLngMustBeANumberErrorText;
        throw latAndLngMustBeANumberErrorText;
    }
}

function getLink() {
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;
    let myUrl = new URL("https://daemon2017.github.io/yFarseerWeb/");
    myUrl.searchParams.append(LAT_URL_PARAM, map.getCenter().lat);
    myUrl.searchParams.append(LNG_URL_PARAM, map.getCenter().lng);
    myUrl.searchParams.append(ZOOM_URL_PARAM, map.getZoom());
    myUrl.searchParams.append(ISEXTENDED_URL_PARAM, document.getElementById(EXTENDED_CHECKBOX_ELEMENT_ID).checked);
    myUrl.searchParams.append(THRESHOLD_URL_PARAM, document.getElementById(INTENSITY_SLIDER_ELEMENT_ID).value);
    myUrl.searchParams.append(SNPS_URL_PARAM, document.getElementById(SEARCH_FORM_ELEMENT_ID).value.replace(/ /g, ""));
    myUrl.searchParams.append(MODE_URL_PARAM, mode);

    window.prompt("Copy to clipboard: Ctrl+C, Enter", myUrl);
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = OK_STATE_TEXT;
}

function printSnpReceivingState(errorSnpList, snpList) {
    if (errorSnpList.length === 0) {
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = OK_STATE_TEXT;
    } else if (snpList.length - errorSnpList.length === 0) {
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText =
            `Error: Data of all SNPs wasn't received!`;
    } else {
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText =
            `Error: Data of SNPs ${errorSnpList.join(",")} wasn't received!`;
    }
}

function getArrayMax(myArray, n, property) {
    return Math.max.apply(Math, myArray[n].map(function (o) {
        return o[property];
    }));
}

async function showCorrelation(isAll, snpString) {
    document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = BUSY_STATE_TEXT;

    if (isAll) {
        mode = Modes.CORRELATION_ALL_MODE;
    } else {
        mode = Modes.CORRELATION_INTERSECT_MODE;
    }

    clearAll(false);
    if (snpString === null | snpString === undefined) {
        snpString = document.getElementById(SEARCH_FORM_ELEMENT_ID).value;
    }
    let snpList = getSnpList(snpString);

    let allSnpPointsList = [];
    if (snpList !== undefined) {
        let errorSnpList = [];
        for (const snp of snpList) {
            try {
                let data = await getDocFromDb(snp);
                allSnpPointsList.push(data);
            } catch (e) {
                errorSnpList.push(snp);
            }
        }

        let correlationMatrix = getCorrelationMatrix(allSnpPointsList);

        let successSnpList = snpList.filter(function (snp) {
            return !errorSnpList.includes(snp);
        });
        if (successSnpList.length > 0) {
            document.getElementById(CORRELATION_MATRIX_ELEMENT_ID).innerHTML = getHtmlTable(correlationMatrix, successSnpList);
            $("table").tablesort();
            $("thead th.amount").data("sortBy", function (_th, td, _tablesort) {
                return parseFloat(td.text());
            });
        }

        printSnpReceivingState(errorSnpList, snpList);
    }
}

function getCorrelationMatrix(allSnpPointsList) {
    let correlationMatrix = [];
    allSnpPointsList.forEach(function (firstSnpPointsList, firstSnpIndex) {
        let firstSnpPointToDiversityPercentDict = getPointToDiversityPercentDict(allSnpPointsList, firstSnpIndex, firstSnpPointsList);

        let correlationRow = getCorrelationRow(allSnpPointsList, firstSnpPointToDiversityPercentDict);
        correlationMatrix.push(correlationRow);
    });
    return correlationMatrix;
}

function getCorrelationRow(allSnpPointsList, firstSnpPointToDiversityPercentDict) {
    let correlationRow = [];
    allSnpPointsList.forEach(function (secondSnpPointsList, secondSnpIndex) {
        let secondSnpPointToDiversityPercentDict = getPointToDiversityPercentDict(allSnpPointsList, secondSnpIndex, secondSnpPointsList);
        let allPossiblePointsList = getAllPossiblePoints(firstSnpPointToDiversityPercentDict, secondSnpPointToDiversityPercentDict);
        let diversityLevelList = getDiversityLevelList(firstSnpPointToDiversityPercentDict, secondSnpPointToDiversityPercentDict, allPossiblePointsList);
        if (mode === Modes.CORRELATION_ALL_MODE) {
            getCorrelationAllRow(correlationRow, diversityLevelList);
        } else if (mode === Modes.CORRELATION_INTERSECT_MODE) {
            getCorrelationIntersectedRow(diversityLevelList, correlationRow);
        }
    });
    return correlationRow;
}

function getCorrelationAllRow(correlationRow, diversityLevelList) {
    correlationRow.push(jStat
        .corrcoeff(diversityLevelList[0], diversityLevelList[1])
        .toFixed(2)
    );
}

function getCorrelationIntersectedRow(diversityLevelList, correlationRow) {
    let newDiversityLevelList = [[], []];
    for (let i = 0; i < diversityLevelList[0].length; i++) {
        if (diversityLevelList[0][i] !== 0 & diversityLevelList[1][i] !== 0) {
            newDiversityLevelList[0].push(diversityLevelList[0][i]);
            newDiversityLevelList[1].push(diversityLevelList[1][i]);
        }
    }
    correlationRow.push(jStat
        .corrcoeff(newDiversityLevelList[0], newDiversityLevelList[1])
        .toFixed(2)
    );
}

function getDiversityLevelList(firstSnpPointToDiversityPercentDict, secondSnpPointToDiversityPercentDict, allPossiblePointsList) {
    let diversityLevelList = [];
    new Array(firstSnpPointToDiversityPercentDict, secondSnpPointToDiversityPercentDict).forEach(function (dict) {
        let countList = new Array(allPossiblePointsList.length).fill(0);
        allPossiblePointsList.forEach(function (key, index) {
            countList[index] = dict[key] == undefined ? 0 : dict[key];
        });
        diversityLevelList.push(countList);
    });
    return diversityLevelList;
}

function getPointToDiversityPercentDict(allSnpPointsList, index, currentSnpPointsList) {
    let dict = {};
    let max = getArrayMax(allSnpPointsList, index, "count");
    currentSnpPointsList.forEach(function (point) {
        dict[`${point["lat"]};${point["lng"]}`] = point["count"] / max;
    });
    return dict;
}

function getAllPossiblePoints(aPointToDiversityPercentDict, bPointToDiversityPercentDict) {
    let allPossiblePointsList = Object.keys(aPointToDiversityPercentDict).concat(Object.keys(bPointToDiversityPercentDict));
    allPossiblePointsList = Array.from(new Set(allPossiblePointsList));
    allPossiblePointsList = allPossiblePointsList.sort();
    return allPossiblePointsList;
}

function isArraysEquals(a, b) {
    if (a === b) {
        return true;
    }
    if (a == null || b == null) {
        return false;
    }
    if (a.length !== b.length) {
        return false;
    }
    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

function getHtmlTable(myArray, successSnpList) {
    let result =
        "<table id='correlTable'><caption>Correlation matrix (sortable!):</caption>";
    myArray.forEach(function (row, i) {
        if (i === 0) {
            result += "<thead>";
            result += "<tr>";
            result += "<th>SNP</th>";
            row.forEach(function (_column, j) {
                result += `<th class="amount">${successSnpList[j]}</th>`;
            });
            result += "</tr>";
            result += "</thead>";

            result += "<tbody>";
        }
        result += "<tr>";
        row.forEach(function (column, j) {
            if (j === 0) {
                result += `<td>${successSnpList[i]}</td>`;
            }
            result += `<td class="${getCorrelationClass(column)}">` + column + "</td>";
        });
        result += "</tr>";
    });
    result += "</tbody>";
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