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
                let terms = split(this.value);
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
    if (mode === Mode.LEVEL) {
        showMap(false, snpString);
    } else if (mode === Mode.DISPERSION) {
        showMap(true, snpString);
    } else if (mode === Mode.CORRELATION_INTERSECT) {
        showCorrelation(false, snpString);
    } else if (mode === Mode.CORRELATION_ALL) {
        showCorrelation(true, snpString);
    } else if (mode === Mode.TRACE) {
        showTrace(snpString);
    }
}

function updateUncheckedList(i) {
    if (document.getElementById(`checkBox${i}`).checked === true) {
        uncheckedSnpsList = uncheckedSnpsList.filter(item => item !== i);
    } else {
        uncheckedSnpsList.push(i);
    }
    drawLayers(currentSnpList, 10 - document.getElementById(INTENSITY_SLIDER_ELEMENT_ID).value);
}

function getMapWithoutUpperLayers() {
    let newMap = map;
    newMap.eachLayer(function (layer) {
        if (layer._url === undefined) {
            newMap.removeLayer(layer);
        }
    });
    return newMap;
}

function getMapWithoutHeatmapLayers() {
    let newMap = map;
    newMap.eachLayer(function (layer) {
        if (layer._heatmap !== undefined) {
            newMap.removeLayer(layer);
        }
    });
    return newMap;
}

function getMapWithoutPolylineLayers() {
    let newMap = map;
    newMap.eachLayer(function (layer) {
        if (layer._parts !== undefined && layer._parts.length !== 0) {
            newMap.removeLayer(layer);
        }
    });
    return newMap;
}

function getSnpListWithChecks(snpString) {
    let snpList = getSnpList(snpString);

    if (snpList !== null && snpList !== undefined && snpList.length > 0) {
        let maxLength;
        if (mode === Mode.DISPERSION) {
            maxLength = 1;
        } else if (mode === Mode.LEVEL || mode === Mode.TRACE) {
            maxLength = colorBoxesNumber;
        } else if (mode === Mode.CORRELATION_ALL || mode === Mode.CORRELATION_INTERSECT) {
            maxLength = 50;
        }

        if (!(snpList.length > 0 && snpList.length <= maxLength)) {
            let wrongSnpNumberErrorText = `Error: The number of SNPs should be in the range [1;${maxLength}]!`;
            document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = wrongSnpNumberErrorText;
            throw wrongSnpNumberErrorText;
        }

        return snpList;
    } else {
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = NO_SNP_WAS_SPECIFIED_ERROR_TEXT;
        throw NO_SNP_WAS_SPECIFIED_ERROR_TEXT;
    }
}

function getSnpList(snpString) {
    let snpList = [];

    if (snpString === null || snpString === undefined || snpString === "") {
        snpString = document.getElementById(SEARCH_FORM_ELEMENT_ID).value;
    }

    if (snpString !== null && snpString !== undefined && snpString !== "") {
        snpString = snpString.toUpperCase().replace(/ /g, "").replace(/\t/g, "");
        if (snpString === "") {
            document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = NO_SNP_WAS_SPECIFIED_ERROR_TEXT;
            throw NO_SNP_WAS_SPECIFIED_ERROR_TEXT;
        }

        snpList = snpString.split(",");
        snpList = snpList.filter(function (snp) {
            return snp !== "";
        });
        document.getElementById(SEARCH_FORM_ELEMENT_ID).value = snpList.join(",");

        return snpList;
    } else {
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = NO_SNP_WAS_SPECIFIED_ERROR_TEXT;
        throw NO_SNP_WAS_SPECIFIED_ERROR_TEXT;
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
                let data = await getDocFromDb(document.getElementById(EXTENDED_CHECKBOX_ELEMENT_ID).checked ? "new_snps_extended" : "new_snps", snp);
                dataList.push(data);
            } catch (e) {
                errorSnpList.push(snp);
            }
        }
        let finalSnpList = snpList.filter(function (item) {
            return errorSnpList.indexOf(item) < 0;
        });
        let newMap = getMapWithoutHeatmapLayers();
        for (let i = 0; i < finalSnpList.length; i++) {
            if (dataList[i] !== undefined) {
                if (mode === Mode.DISPERSION) {
                    newMap = drawDispersionLayers(dataList, i, newMap, heatmapCfg, threshold);
                } else if (mode === Mode.LEVEL) {
                    newMap = drawLevelsLayers(i, newMap, heatmapCfg, dataList, threshold, finalSnpList);
                }
            }
        }
        map = newMap;
        printSnpReceivingState(errorSnpList, snpList);
    }
}

async function drawTrace(snpList) {
    if (snpList !== undefined) {
        let errorSnpList = [];
        let i = 0;
        for (const snp of snpList) {
            try {
                let prevoiusCenter;
                let j = 0;
                let parentSnpList = getParentSnpList(snp);
                for (const parentSnp of parentSnpList) {
                    let data = await getDocFromDb(document.getElementById(EXTENDED_CHECKBOX_ELEMENT_ID).checked ? "new_snps_extended" : "new_snps", parentSnp);
                    if (j === 0) {
                        updateCheckbox(i, snpList[i]);
                    }
                    let max = getArrayMax(data, "count");
                    let newData = data.filter(function (el) {
                        return el.count == max;
                    });
                    let pointList = [];
                    for (const record of newData) {
                        let point = turf.point([record.lat, record.lng]);
                        pointList.push(point);
                    }
                    let pointCollection = turf.featureCollection(pointList);
                    let center = turf.centerOfMass(pointCollection);
                    if (j > 0) {
                        L.polyline([prevoiusCenter, center.geometry.coordinates], {
                            color: gradientValues[i][6]
                        }).addTo(map);
                    }
                    prevoiusCenter = center.geometry.coordinates;
                    j++;
                }
            } catch (e) {
                errorSnpList.push(snp);
            }
            i++;
        }
        printSnpReceivingState(errorSnpList, snpList);
    }
}

function drawDispersionLayers(dataList, i, newMap, heatmapCfg, threshold) {
    let snpCombinationsList = getSnpCombinationsList(dataList[i]);
    if (snpCombinationsList.length <= colorBoxesNumber) {
        let pointGroupsList = getPointGroupsList(snpCombinationsList, dataList[i]);
        for (let j = 0; j < snpCombinationsList.length; j++) {
            if (!uncheckedSnpsList.includes(j)) {
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
    if (mode === Mode.DISPERSION) {
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

async function getDocFromDb(collection, snp) {
    let db = firebase.firestore();
    let docRef = db.collection(collection).doc(snp);
    let doc = await docRef.get();
    return JSON.parse(doc.data().data);
}

async function getCollectionFromDb(collection) {
    let db = firebase.firestore();
    let collRef = db.collection(collection);
    let coll = await collRef.get();
    let data = {};
    coll.docs.map(doc => data = Object.assign({}, data, JSON.parse(doc.data().data)));
    return data;
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

function printSnpReceivingState(errorSnpList, snpList) {
    if (errorSnpList.length === 0) {
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText = OK_STATE_TEXT;
    } else if (snpList.length - errorSnpList.length === 0) {
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText =
            DATA_OF_ALL_SNPS_WASNT_RECEIVED_ERROR_TEXT;
        throw DATA_OF_ALL_SNPS_WASNT_RECEIVED_ERROR_TEXT;
    } else {
        let snpWasntReceivedErrorText = `Error: Data of SNPs ${errorSnpList.join(",")} wasn't received!`;
        document.getElementById(STATE_LABEL_ELEMENT_ID).innerText =
            snpWasntReceivedErrorText;
        throw snpWasntReceivedErrorText;
    }
}

function getArrayMax(myArray, property) {
    return Math.max.apply(Math, myArray.map(function (o) {
        return o[property];
    }));
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
        if (mode === Mode.CORRELATION_ALL) {
            getCorrelationAllRow(correlationRow, diversityLevelList);
        } else if (mode === Mode.CORRELATION_INTERSECT) {
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
    let newDiversityLevelList = [
        [],
        []
    ];
    for (let i = 0; i < diversityLevelList[0].length; i++) {
        if (diversityLevelList[0][i] !== 0 && diversityLevelList[1][i] !== 0) {
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
    let max = getArrayMax(allSnpPointsList[index], "count");
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
    for (let i = 0; i < a.length; ++i) {
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

function getParentSnpList(snp) {
    let parentList = [];
    for (let haplogroupId of Object.keys(haplotree)) {
        if (snp === haplotree[haplogroupId]['name']) {
            while (true) {
                parentList.push(haplotree[haplogroupId]['name']);
                if (haplotree[haplogroupId].hasOwnProperty('parentId')) {
                    haplogroupId = haplotree[haplogroupId]['parentId'];
                } else {
                    break;
                }
            }
            break;
        }
    }
    return parentList;
}