"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const insertTableRowsQuery = async (doc, data, resolver) => {
    const specialPlaceholders = findSpecialPlaceholders(doc);
    return computeRequestsToInsertTableRows(specialPlaceholders, data, resolver);
};
const findSpecialPlaceholders = (doc) => {
    const specialplaceholders = [];
    const processContent = (content, index = -1, tableIndex = -1) => {
        content.map(c => {
            if (c.paragraph) {
                c.paragraph.elements.map((e) => {
                    if (e.textRun) {
                        const start_matches = e.textRun.content.match(/{{#([^}]*)}}/gi) || [];
                        start_matches.forEach((m) => {
                            const placeholder = m.slice(3, -2);
                            specialplaceholders.push({
                                startRow: index,
                                placeholder,
                                tableIndex,
                                endRow: -1
                            });
                        });
                        const end_matches = e.textRun.content.match(/{{\/([^}]*)}}/gi) || [];
                        end_matches.forEach((m) => {
                            const placeholder = m.slice(3, -2);
                            specialplaceholders.forEach(sp => {
                                if (sp.endRow === -1 && sp.placeholder === placeholder) {
                                    sp.endRow = index;
                                }
                            });
                        });
                    }
                });
            }
            if (c.table) {
                c.table.tableRows.map((r, index) => {
                    r.tableCells.map((cell) => {
                        processContent(cell.content, index, c.startIndex);
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
    return specialplaceholders;
};
const computeRequestsToInsertTableRows = async (SPlaceholders, data, resolver) => {
    let requests = [];
    await Promise.all(SPlaceholders.reverse().map(async (placeholder) => {
        if (placeholder.startRow === -1 || placeholder.endRow === -1)
            return;
        if (typeof data[placeholder.placeholder] === "function")
            return;
        let itemsLength = 0;
        let sectionData = data[placeholder.placeholder];
        if (sectionData) {
            itemsLength = sectionData.length;
        }
        if (!sectionData && resolver) {
            sectionData = await resolver(placeholder.placeholder);
            if (sectionData)
                itemsLength =
                    typeof sectionData.length === "function"
                        ? sectionData.length()
                        : sectionData.length;
        }
        if (!sectionData || itemsLength <= 0)
            return;
        const insertRowAmount = itemsLength * (placeholder.endRow - placeholder.startRow + 1);
        const insertArray = new Array(insertRowAmount).fill({
            insertTableRow: {
                tableCellLocation: {
                    tableStartLocation: { index: placeholder.tableIndex },
                    rowIndex: placeholder.endRow
                },
                insertBelow: true
            }
        });
        requests = [...requests, ...insertArray];
    }));
    return requests;
};
exports.default = insertTableRowsQuery;
