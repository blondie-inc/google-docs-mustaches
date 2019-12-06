"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const insertTableRowsQuery = (doc, data) => {
    const specialPlaceholders = findSpecialPlaceholders(doc);
    const requests = computeRequestForInsertTableRows(specialPlaceholders, data);
    return { requests, specialPlaceholders };
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
const computeRequestForInsertTableRows = (SPlaceholders, data) => {
    const requests = [];
    SPlaceholders.reverse().forEach((placeholder) => {
        if (placeholder.endRow === -1)
            return;
        if (!data[placeholder.placeholder])
            return;
        const itemsLength = data[placeholder.placeholder].length || 0;
        for (var i = 0; i < itemsLength; i++) {
            for (var j = 0; j <= placeholder.endRow - placeholder.startRow; j++) {
                requests.push({
                    insertTableRow: {
                        tableCellLocation: {
                            tableStartLocation: { index: placeholder.tableIndex },
                            rowIndex: placeholder.endRow
                        },
                        insertBelow: true
                    }
                });
            }
        }
    });
    return requests;
};
exports.default = insertTableRowsQuery;
