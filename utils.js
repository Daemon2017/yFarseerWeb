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

function getMapWithoutCircleLayers() {
    let newMap = map;
    newMap.eachLayer(function (layer) {
        if (layer._radius !== undefined) {
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
        let i = 0;
        for (const finalSnp of finalSnpList) {
            if (dataList[i] !== undefined) {
                if (mode === Mode.DISPERSION) {
                    newMap = drawDispersionLayers(dataList, i, newMap, heatmapCfg, threshold);
                } else if (mode === Mode.LEVEL) {
                    newMap = drawLevelsLayers(i, newMap, heatmapCfg, dataList, threshold, finalSnpList);
                }
            }
            i++;
        }
        map = newMap;
        printSnpReceivingState(errorSnpList, snpList);
    }
}

async function drawTrace(snpList) {
    if (snpList !== undefined) {
        let parentSnpSet = new Set();
        for (const snp of snpList) {
            parentSnpSet.add(snp);
            getAncestorSnpList(snp).forEach(item => parentSnpSet.add(item));
        }
        let errorSnpList = [];
        let snpToDataDict = {};
        for (const item of parentSnpSet) {
            try {
                snpToDataDict[item] = await getDocFromDb(document.getElementById(EXTENDED_CHECKBOX_ELEMENT_ID).checked ? "new_snps_extended" : "new_snps", item);
            } catch (e) {
                errorSnpList.push(item);
            }
        }
        let newSnpList = snpList.filter(function (item) {
            return errorSnpList.indexOf(item) < 0;
        });
        let newMap = getMapWithoutHeatmapLayers();
        let i = 0;
        for (const newSnp of newSnpList) {
            if (snpToDataDict[newSnp] !== undefined) {
                let prevoiusCenter;
                let j = 0;
                let ancestorSnpList = getAncestorSnpList(newSnp);
                let previousAncestorSnp = newSnp;
                for (const ancestorSnp of ancestorSnpList) {
                    if (j < 5) {
                        if (j === 0) {
                            updateCheckbox(i, newSnp);
                        }
                        let newData = snpToDataDict[ancestorSnp].filter(function (el) {
                            return el.count == getArrayMax(snpToDataDict[ancestorSnp], "count");
                        });
                        let bigCenter = getCenter(newData);
                        if (j == 0) {
                            L.circle([bigCenter.geometry.coordinates[0], bigCenter.geometry.coordinates[1]], {
                                color: gradientValues[i][9],
                                radius: 25000,
                                fillOpacity: 1.0
                            }).addTo(newMap).bindPopup(ancestorSnp);
                        } else {
                            let snpCombinationList = getSnpCombinationsList(snpToDataDict[ancestorSnp]);
                            let pointGroupsList = getPointGroupsList(snpCombinationList, snpToDataDict[ancestorSnp]);
                            let max = getChildSnpList(ancestorSnp).length;
                            for (let d = 2; d < max; d++) {
                                let currentDiversityPointList = [];
                                let currentSnpCombinationList = [];
                                let k = 0;
                                for (const snpCombination of snpCombinationList) {
                                    if (snpCombination.includes(previousAncestorSnp) && snpCombination.length === d) {
                                        currentDiversityPointList = currentDiversityPointList.concat(pointGroupsList[k]);
                                        currentSnpCombinationList = currentSnpCombinationList.concat(snpCombination);
                                    }
                                    k++;
                                }
                                if (currentDiversityPointList.length > 0) {
                                    let smallCenter = getCenter(currentDiversityPointList);
                                    let groupName = d + 'L: ' + currentSnpCombinationList.length + 'C: ' + Array.from(new Set(currentSnpCombinationList)).join(',');
                                    L.circle([smallCenter.geometry.coordinates[0], smallCenter.geometry.coordinates[1]], {
                                        color: gradientValues[i][5],
                                        radius: 12500,
                                        fillOpacity: 0.33
                                    }).addTo(newMap).bindPopup(groupName);
                                    L.polyline([prevoiusCenter, smallCenter.geometry.coordinates], {
                                        color: gradientValues[i][6]
                                    }).addTo(newMap);
                                    prevoiusCenter = smallCenter.geometry.coordinates;
                                }
                            }
                            L.circle([bigCenter.geometry.coordinates[0], bigCenter.geometry.coordinates[1]], {
                                color: gradientValues[i][5],
                                radius: 25000,
                                fillOpacity: 0.66
                            }).addTo(newMap).bindPopup(ancestorSnp);
                            L.polyline([prevoiusCenter, bigCenter.geometry.coordinates], {
                                color: gradientValues[i][6]
                            }).addTo(newMap);
                        }
                        prevoiusCenter = bigCenter.geometry.coordinates;
                        j++;
                        previousAncestorSnp = ancestorSnp;
                    }
                }
            }
            i++;
        }
        map = newMap;
        printSnpReceivingState(errorSnpList, snpList);
    }
}

function getCenter(data){
    let pointList = [];
    for (const record of data) {
        let point = turf.point([record.lat, record.lng]);
        pointList.push(point);
    }
    let pointCollection = turf.featureCollection(pointList);
    let center = turf.centroid(pointCollection);
    return center;
}

function drawDispersionLayers(dataList, i, newMap, heatmapCfg, threshold) {
    let snpCombinationList = getSnpCombinationsList(dataList[i]);
    if (snpCombinationList.length <= colorBoxesNumber) {
        let pointGroupsList = getPointGroupsList(snpCombinationList, dataList[i]);
        let j = 0;
        for (const snpCombination of snpCombinationList) {
            if (!uncheckedSnpsList.includes(j)) {
                newMap = getMapWithNewLayer(heatmapCfg, j, pointGroupsList[j], threshold, newMap);
                updateCheckbox(j, snpCombination.join(","));
            }
            j++;
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

function getDiversityLevelList(snpCombinationList) {
    let diversityLevelList = [];
    for (const snpCombination of snpCombinationList) {
        diversityLevelList.push(snpCombination.length);
    }
    return diversityLevelList;
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
    } else if (snpList.length === errorSnpList.length) {
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
    if (property !== null) {
        return Math.max.apply(Math, myArray.map(function (o) {
            return o[property];
        }));
    }
    else {
        return Math.max.apply(null, myArray);
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
        let diversityPercentList = getDiversityPercentList(firstSnpPointToDiversityPercentDict, secondSnpPointToDiversityPercentDict, allPossiblePointsList);
        if (mode === Mode.CORRELATION_ALL) {
            getCorrelationAllRow(correlationRow, diversityPercentList);
        } else if (mode === Mode.CORRELATION_INTERSECT) {
            getCorrelationIntersectedRow(diversityPercentList, correlationRow);
        }
    });
    return correlationRow;
}

function getCorrelationAllRow(correlationRow, diversityPercentList) {
    correlationRow.push(jStat
        .corrcoeff(diversityPercentList[0], diversityPercentList[1])
        .toFixed(2)
    );
}

function getCorrelationIntersectedRow(diversityPercentList, correlationRow) {
    let newDiversityPercentList = [
        [],
        []
    ];
    for (let i = 0; i < diversityPercentList[0].length; i++) {
        if (diversityPercentList[0][i] !== 0 && diversityPercentList[1][i] !== 0) {
            newDiversityPercentList[0].push(diversityPercentList[0][i]);
            newDiversityPercentList[1].push(diversityPercentList[1][i]);
        }
    }
    correlationRow.push(jStat
        .corrcoeff(newDiversityPercentList[0], newDiversityPercentList[1])
        .toFixed(2)
    );
}

function getDiversityPercentList(firstSnpPointToDiversityPercentDict, secondSnpPointToDiversityPercentDict, allPossiblePointsList) {
    let diversityPercentList = [];
    new Array(firstSnpPointToDiversityPercentDict, secondSnpPointToDiversityPercentDict).forEach(function (dict) {
        let countList = new Array(allPossiblePointsList.length).fill(0);
        allPossiblePointsList.forEach(function (key, index) {
            countList[index] = dict[key] == undefined ? 0 : dict[key];
        });
        diversityPercentList.push(countList);
    });
    return diversityPercentList;
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

function getAncestorSnpList(snp) {
    let ancestorSnpList = [];
    for (let haplogroupId of Object.keys(haplotree)) {
        if (snp === haplotree[haplogroupId]['name']) {
            while (true) {
                ancestorSnpList.push(haplotree[haplogroupId]['name']);
                if (haplotree[haplogroupId].hasOwnProperty('parentId')) {
                    haplogroupId = haplotree[haplogroupId]['parentId'];
                } else {
                    break;
                }
            }
            break;
        }
    }
    return ancestorSnpList;
}

function getChildSnpList(snp) {
    let childSnpList = [];
    for (const haplogroupId of Object.keys(haplotree)) {
        if (snp === haplotree[haplogroupId]['name']) {
            for (const childSnpId of haplotree[haplogroupId]['children']) {
                childSnpList.push(haplotree[childSnpId]['name']);
            }
            break;
        }
    }
    return childSnpList;
}