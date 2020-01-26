"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const updateTableRowsQuery = async (doc, data, resolver) => {
    const placeholders = getSpecialPlaceholderInfo(doc);
    console.log("sectiondata123", placeholders);
    const requests = await computeQueries(placeholders, data, resolver);
    return requests;
};
const getSpecialPlaceholderInfo = (doc) => {
    const sectionsInfo = [];
    const processContent = (content, index = -1, table = {}) => {
        content.map(c => {
            if (c.paragraph) {
                c.paragraph.elements.map((e) => {
                    if (e.textRun) {
                        const start_matches = e.textRun.content.match(/{{#([^}]*)}}/gi) || [];
                        start_matches.forEach((m) => {
                            const sectionName = m.slice(3, -2);
                            sectionsInfo.push({
                                table,
                                startRowIndex: index,
                                sectionName,
                                endRowIndex: -1
                            });
                        });
                        const end_matches = e.textRun.content.match(/{{\/([^}]*)}}/gi) || [];
                        end_matches.forEach((m) => {
                            const sectionName = m.slice(3, -2);
                            sectionsInfo.forEach(sp => {
                                if (sp.endRowIndex === -1 && sp.sectionName === sectionName) {
                                    sp.endRowIndex = index;
                                }
                            });
                        });
                    }
                });
            }
            if (c.table) {
                c.table.tableRows.forEach((r, index) => {
                    r.tableCells.forEach((cell) => {
                        processContent(cell.content, index, c.table);
                    });
                });
            }
        });
    };
    if (doc.headers) {
        Object.keys(doc.headers).forEach(key => {
            processContent(doc.headers[key].content);
        });
    }
    if (doc.body) {
        processContent(doc.body.content);
    }
    return sectionsInfo;
};
const computeQueries = async (sectionsInfo, data, resolver) => {
    const requests = [];
    let currentPlaceholder = "";
    let currentResolverValue;
    let repeatCounter = 0;
    const processCell = async (srcContent, dstContent) => {
        srcContent = Object.create(srcContent).reverse();
        for (const [index, c] of srcContent.entries()) {
            if (c.paragraph) {
                const elements = Object.create(c.paragraph.elements).reverse();
                for (const e of elements) {
                    if (e.textRun) {
                        let text = e.textRun.content;
                        const textStyle = e.textRun.textStyle;
                        const matches = e.textRun.content.match(/{{([^}#/]*)}}/gi) || [];
                        if (matches && matches.length > 0) {
                            for (const m of matches) {
                                const subPlaceHolder = m.slice(2, -2);
                                if (data[currentPlaceholder] &&
                                    data[currentPlaceholder][0] &&
                                    data[currentPlaceholder][0][subPlaceHolder]) {
                                    text = text
                                        .replace(`{{${subPlaceHolder}}}`, `{{${currentPlaceholder}[${repeatCounter}].${subPlaceHolder}}}`)
                                        .replace(`{{#${currentPlaceholder}}}`, "")
                                        .replace(`{{/${currentPlaceholder}}}`, "");
                                }
                                else if (resolver) {
                                    const resolvedValue = await resolver(`${currentPlaceholder}.${repeatCounter}.${subPlaceHolder}`);
                                    console.log("---resolved---", resolvedValue, currentPlaceholder, subPlaceHolder);
                                    if (resolvedValue) {
                                        text = text
                                            .replace(`{{${subPlaceHolder}}}`, `${resolvedValue}`)
                                            .replace(`{{#${currentPlaceholder}}}`, "")
                                            .replace(`{{/${currentPlaceholder}}}`, "");
                                    }
                                }
                            }
                        }
                        text = text.replace(`{{/${currentPlaceholder}}}`, "");
                        if (index === 0)
                            text = text.replace("\n", "");
                        if (text !== "" && text !== "\n") {
                            requests.push({
                                insertText: {
                                    text,
                                    location: {
                                        index: dstContent[0].paragraph.elements[0].startIndex
                                    }
                                }
                            });
                            requests.push({
                                updateTextStyle: {
                                    textStyle,
                                    range: {
                                        startIndex: dstContent[0].paragraph.elements[0].startIndex,
                                        endIndex: dstContent[0].paragraph.elements[0].startIndex +
                                            text.length
                                    },
                                    fields: "*"
                                }
                            });
                        }
                    }
                }
            }
            if (c.table) {
                for (const [index1, r] of c.table.tableRows) {
                    for (const c of r.tableCells) {
                        await processCell(c.content, dstContent[index].table.tableRows[index1].content);
                    }
                }
            }
        }
    };
    const processRow = async (srcRow, dstRow) => {
        const srcCells = Object.create(srcRow.tableCells).reverse();
        const dstCells = Object.create(dstRow.tableCells).reverse();
        for (const [index, c] of srcCells.entries()) {
            await processCell(c.content, dstCells[index].content);
        }
    };
    sectionsInfo = Object.create(sectionsInfo).reverse();
    for (const pInfo of sectionsInfo) {
        const { table: { tableRows }, startRowIndex, endRowIndex, sectionName } = pInfo;
        if (startRowIndex === -1 || endRowIndex === -1)
            continue;
        if (typeof data[sectionName] === "function")
            continue;
        let repeatAmount = 0;
        let sectionData = data[sectionName];
        if (sectionData) {
            repeatAmount = sectionData.length;
        }
        if (!sectionData && resolver) {
            sectionData = await resolver(sectionName);
            if (sectionData)
                repeatAmount =
                    typeof sectionData.length === "function"
                        ? sectionData.length()
                        : sectionData.length;
        }
        if (!sectionData || repeatAmount <= 0)
            continue;
        currentPlaceholder = sectionName;
        const srcLength = endRowIndex - startRowIndex + 1;
        for (var i = repeatAmount; i > 0; i--) {
            repeatCounter = i - 1;
            for (var j = srcLength - 1; j >= 0; j--) {
                await processRow(tableRows[startRowIndex + j], tableRows[startRowIndex + i * srcLength + j]);
            }
        }
        for (var k = endRowIndex; k >= startRowIndex; k--) {
            requests.push({
                deleteTableRow: {
                    tableCellLocation: {
                        tableStartLocation: { index: tableRows[0].startIndex - 1 },
                        rowIndex: k
                    }
                }
            });
        }
    }
    return requests;
};
exports.default = updateTableRowsQuery;
