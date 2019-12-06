"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const updateTableRowsQuery = (doc, data) => {
    const placeholders = getSpecialPlaceholderInfo(doc);
    const requests = computeQueries(placeholders, data);
    return requests;
};
const getSpecialPlaceholderInfo = (doc) => {
    const SPlaceholderInfos = [];
    const processContent = (content, index = -1, table = {}) => {
        content.map(c => {
            if (c.paragraph) {
                c.paragraph.elements.map((e) => {
                    if (e.textRun) {
                        const start_matches = e.textRun.content.match(/{{#([^}]*)}}/gi) || [];
                        start_matches.forEach((m) => {
                            const placeholder = m.slice(3, -2);
                            SPlaceholderInfos.push({
                                table,
                                startRowIndex: index,
                                placeholder,
                                endRowIndex: -1
                            });
                        });
                        const end_matches = e.textRun.content.match(/{{\/([^}]*)}}/gi) || [];
                        end_matches.forEach((m) => {
                            const placeholder = m.slice(3, -2);
                            SPlaceholderInfos.forEach(sp => {
                                if (sp.endRowIndex === -1 && sp.placeholder === placeholder) {
                                    sp.endRowIndex = index;
                                }
                            });
                        });
                    }
                });
            }
            if (c.table) {
                c.table.tableRows.map((r, index) => {
                    r.tableCells.map((cell) => {
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
    return SPlaceholderInfos;
};
const computeQueries = (SPlaceholderInfos, data) => {
    const requests = [];
    let currentPlaceholder = "";
    let repeatCounter = 0;
    const processCell = (srcContent, dstContent) => {
        srcContent.map((c, index) => {
            if (c.paragraph) {
                const elements = Object.create(c.paragraph.elements).reverse();
                elements.map((e) => {
                    if (e.textRun) {
                        let text = e.textRun.content;
                        const textStyle = e.textRun.textStyle;
                        const matches = e.textRun.content.match(/{{([^}]*)}}/gi) || [];
                        matches.forEach((m) => {
                            const subPlaceHolder = m.slice(2, -2);
                            if (data[currentPlaceholder] &&
                                data[currentPlaceholder][0] &&
                                data[currentPlaceholder][0][subPlaceHolder]) {
                                text = text.replace(`{{${subPlaceHolder}}}`, `{{${currentPlaceholder}[${repeatCounter}].${subPlaceHolder}}}`);
                            }
                        });
                        requests.push({
                            insertText: {
                                text,
                                location: {
                                    index: dstContent[index].paragraph.elements[0].startIndex
                                }
                            }
                        });
                        requests.push({
                            updateTextStyle: {
                                textStyle,
                                range: {
                                    startIndex: dstContent[index].paragraph.elements[0].startIndex,
                                    endIndex: dstContent[index].paragraph.elements[0].startIndex +
                                        text.length
                                },
                                fields: "*"
                            }
                        });
                    }
                });
            }
            if (c.table) {
                c.table.tableRows.map((r, index1) => {
                    r.tableCells.map((c) => {
                        processCell(c.content, dstContent[index].table.tableRows[index1].content);
                    });
                });
            }
        });
    };
    const processRow = (srcRow, dstRow) => {
        const srcCells = Object.create(srcRow.tableCells).reverse();
        const dstCells = Object.create(dstRow.tableCells).reverse();
        srcCells.forEach((c, index) => {
            processCell(c.content, dstCells[index].content);
        });
    };
    SPlaceholderInfos.reverse().forEach((pInfo) => {
        const { table: { tableRows }, startRowIndex, endRowIndex, placeholder } = pInfo;
        if (endRowIndex === -1)
            return;
        currentPlaceholder = placeholder;
        const repeatAmount = data[currentPlaceholder].length;
        const srcLength = endRowIndex - startRowIndex + 1;
        for (var i = repeatAmount; i > 0; i--) {
            repeatCounter = i - 1;
            for (var j = srcLength - 1; j >= 0; j--) {
                processRow(tableRows[startRowIndex + j], tableRows[startRowIndex + i * srcLength + j]);
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
    });
    return requests;
};
exports.default = updateTableRowsQuery;
