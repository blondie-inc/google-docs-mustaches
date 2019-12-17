import { GDoc, Request } from "./types";

const updateTableRowsQuery = (
  doc: GDoc,
  data: any,
  resolver?: Function
): Request[] => {
  const placeholders = getSpecialPlaceholderInfo(doc);

  const requests = computeQueries(placeholders, data, resolver);

  return requests;
};

const getSpecialPlaceholderInfo = (doc: GDoc): any[] => {
  const SPlaceholderInfos: any[] = [];

  const processContent = (
    content: any[],
    index: number = -1,
    table: any = {}
  ) => {
    content.map(c => {
      if (c.paragraph) {
        c.paragraph.elements.map((e: any) => {
          if (e.textRun) {
            const start_matches =
              e.textRun.content.match(/{{#([^}]*)}}/gi) || [];
            start_matches.forEach((m: any) => {
              const placeholder = m.slice(3, -2);
              SPlaceholderInfos.push({
                table,
                startRowIndex: index,
                placeholder,
                endRowIndex: -1
              });
            });

            const end_matches =
              e.textRun.content.match(/{{\/([^}]*)}}/gi) || [];
            end_matches.forEach((m: any) => {
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
        c.table.tableRows.map((r: any, index: number) => {
          r.tableCells.map((cell: any) => {
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

const computeQueries = (
  SPlaceholderInfos: any,
  data: any,
  resolver?: Function
): Request[] => {
  const requests: Request[] = [];
  let currentPlaceholder: string = "";
  let repeatCounter: number = 0;

  //copy cell with same style and changing {{xxx}} => {{items[index].xxx}}
  const processCell = (srcContent: any[], dstContent: any[]) => {
    srcContent.map((c, index) => {
      if (c.paragraph) {
        const elements = Object.create(c.paragraph.elements).reverse();
        elements.map((e: any) => {
          if (e.textRun) {
            let text = e.textRun.content;
            const textStyle = e.textRun.textStyle;

            const matches = e.textRun.content.match(/{{([^}]*)}}/gi) || [];
            matches.forEach(async (m: any) => {
              const subPlaceHolder = m.slice(2, -2);
              let renderAble: boolean = false;
              if (
                data[currentPlaceholder] &&
                data[currentPlaceholder][0] &&
                data[currentPlaceholder][0][subPlaceHolder]
              ) {
                renderAble = true;
              } else if (resolver) {
                const dataByResolver = await resolver(currentPlaceholder);
                if (
                  dataByResolver &&
                  dataByResolver[0] &&
                  dataByResolver[0][subPlaceHolder]
                ) {
                  renderAble = true;
                }
              }

              if (renderAble) {
                text = text.replace(
                  `{{${subPlaceHolder}}}`,
                  `{{${currentPlaceholder}.${repeatCounter}.${subPlaceHolder}}}`
                );
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
                  startIndex:
                    dstContent[index].paragraph.elements[0].startIndex,
                  endIndex:
                    dstContent[index].paragraph.elements[0].startIndex +
                    text.length
                },
                fields: "*"
              }
            });
          }
        });
      }

      if (c.table) {
        c.table.tableRows.map((r: any, index1: number) => {
          r.tableCells.map((c: any) => {
            processCell(
              c.content,
              dstContent[index].table.tableRows[index1].content
            );
          });
        });
      }
    });
  };

  const processRow = (srcRow: any, dstRow: any) => {
    const srcCells = Object.create(srcRow.tableCells).reverse();
    const dstCells = Object.create(dstRow.tableCells).reverse();
    srcCells.forEach((c: any, index: number) => {
      processCell(c.content, dstCells[index].content);
    });
  };

  SPlaceholderInfos.reverse().forEach(async (pInfo: any) => {
    const {
      table: { tableRows },
      startRowIndex,
      endRowIndex,
      placeholder
    } = pInfo;

    if (endRowIndex === -1) return;

    let sectionData = data[placeholder];
    if (!sectionData && resolver) {
      sectionData = await resolver(placeholder);
    }

    if (!sectionData || sectionData.length <= 0) return;

    currentPlaceholder = placeholder;

    const repeatAmount = sectionData.length;
    const srcLength = endRowIndex - startRowIndex + 1;
    for (var i = repeatAmount; i > 0; i--) {
      repeatCounter = i - 1;
      for (var j = srcLength - 1; j >= 0; j--) {
        processRow(
          tableRows[startRowIndex + j],
          tableRows[startRowIndex + i * srcLength + j]
        );
      }
    }

    //Delete src rows which contains from {{#...}} to {{/...}}
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

export default updateTableRowsQuery;
