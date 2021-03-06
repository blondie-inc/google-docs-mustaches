import { GDoc, Request, SPlaceholderInfo } from "./types";

const insertTableRowsQuery = async (
  doc: GDoc,
  data: any,
  resolver?: Function
): Promise<Request[]> => {
  const specialPlaceholders = findSpecialPlaceholders(doc);
  return computeRequestsToInsertTableRows(specialPlaceholders, data, resolver);
};

const findSpecialPlaceholders = (doc: GDoc): SPlaceholderInfo[] => {
  const specialplaceholders: SPlaceholderInfo[] = [];

  const processContent = (
    content: any[],
    index: number = -1,
    tableIndex: number = -1
  ) => {
    content.map(c => {
      if (c.paragraph) {
        c.paragraph.elements.map((e: any) => {
          if (e.textRun) {
            const start_matches =
              e.textRun.content.match(/{{#([^}]*)}}/gi) || [];

            start_matches.forEach((m: any) => {
              const placeholder = m.slice(3, -2);
              specialplaceholders.push({
                startRow: index,
                placeholder,
                tableIndex,
                endRow: -1
              });
            });

            const end_matches =
              e.textRun.content.match(/{{\/([^}]*)}}/gi) || [];
            end_matches.forEach((m: any) => {
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
        c.table.tableRows.map((r: any, index: number) => {
          r.tableCells.map((cell: any) => {
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

const computeRequestsToInsertTableRows = async (
  SPlaceholders: SPlaceholderInfo[],
  data: any,
  resolver?: Function
): Promise<Request[]> => {
  let requests: Request[] = [];

  await Promise.all(
    SPlaceholders.reverse().map(async (placeholder: SPlaceholderInfo) => {
      if (placeholder.startRow === -1 || placeholder.endRow === -1) return;
      if (typeof data[placeholder.placeholder] === "function") return; //if it is mustache function, then skip

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

      if (!sectionData || itemsLength <= 0) return;

      const insertRowAmount =
        itemsLength * (placeholder.endRow - placeholder.startRow + 1);
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
      //Make requests to insert new empty table rows for repeatation.
      // for (var i = 0; i < itemsLength; i++) {
      //   for (var j = 0; j <= placeholder.endRow - placeholder.startRow; j++) {
      //     requests.push({
      //       insertTableRow: {
      //         tableCellLocation: {
      //           tableStartLocation: { index: placeholder.tableIndex },
      //           rowIndex: placeholder.endRow
      //         },
      //         insertBelow: true
      //       }
      //     });
      //   }
      // }
    })
  );

  return requests;
};

export default insertTableRowsQuery;
