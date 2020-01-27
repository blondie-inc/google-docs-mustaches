import { GDoc, Request } from "./types";
import { Formatters } from "../types";

import dot from "./dot";

const interpolate = async (
  doc: GDoc,
  data: any,
  formatters: Formatters,
  resolver?: Function
): Promise<Request[]> => {
  const { placeholders, sections } = scanDoc(doc);
  return computeUpdates(sections, placeholders, data, formatters, resolver);
};

const scanDoc = (doc: GDoc): any => {
  const placeholders: string[] = [];
  const sections: string[] = [];

  const processContent = (content: any[]) => {
    content.map(c => {
      if (c.paragraph) {
        c.paragraph.elements.map((e: any) => {
          if (e.textRun) {
            const placeholderMatches =
              e.textRun.content.match(/{{([^}#/]*)}}/gi) || [];
            placeholderMatches.map((m: any) =>
              placeholders.push(m.slice(2, -2))
            );

            const sectionMatches =
              e.textRun.content.match(/{{#([^}]*)}}.+{{\/([^}]*)}}/gi) || [];
            sectionMatches.map((section: string) => sections.push(section));
          }
        });
      }

      if (c.table) {
        c.table.tableRows.map((r: any) => {
          r.tableCells.map((c: any) => {
            processContent(c.content);
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

  return {
    placeholders,
    sections
  };
};

const availableFormatters: Formatters = {
  lowercase: (s: string) => s.toLowerCase(),
  uppercase: (s: string) => s.toUpperCase()
};

const getComputedValue = async (
  placeholder: string,
  data: any,
  formatters: Formatters,
  resolver?: Function
): Promise<string> => {
  let computed: any;

  try {
    computed = dot(data, placeholder, { formatters });

    if (!computed && resolver) {
      computed = await resolver(placeholder);
    }
  } catch (e) {
    if (resolver) {
      computed = await resolver(placeholder);
    }
  }
  return computed || "";
};

const getComputedValueSync = (
  placeholder: string,
  data: any,
  formatters: Formatters
): string => {
  let computed: any;

  computed = dot(data, placeholder, { formatters });

  return computed || "";
};

const mustachesRender = (
  originText: string,
  data: any,
  formatters: Formatters
): string => {
  const placeholders = originText.match(/{{([^}#/]*)}}/gi) || [];

  return placeholders.reduce((result, placeholder) => {
    const computed = getComputedValueSync(
      placeholder.slice(2, -2),
      data,
      formatters
    );

    result = result.replace(placeholder, computed);
    return result;
  }, originText);
};

const computeUpdates = async (
  sections: string[],
  placeholders: string[],
  data: any,
  formatters: Formatters,
  resolver?: Function
): Promise<Request[]> => {
  formatters = { ...availableFormatters, ...formatters };

  let mFunctionUpdates = await Promise.all(
    sections.map(
      async (section): Promise<any> => {
        const srcSection = section;
        const sectionName = section.slice(3, section.indexOf("}}"));

        if (typeof data[sectionName] === "function") {
          const converter = data[sectionName]();
          const originText = section.slice(
            section.indexOf("}}") + 2,
            section.lastIndexOf("{{")
          );
          let renderedSection = converter(originText, function(text: any) {
            return mustachesRender(text, data, formatters);
          });

          if (sectionName === "eval") {
            try {
              // eslint-disable-next-line no-eval
              renderedSection = String(eval(renderedSection));
            } catch (err) {
              console.log("eval error", err);
            }
          }
          return {
            replaceAllText: {
              replaceText: renderedSection,
              containsText: {
                text: srcSection,
                matchCase: false
              }
            }
          };
        } else if (sectionName === "eval") {
          const originText = section.slice(
            section.indexOf("}}") + 2,
            section.lastIndexOf("{{")
          );

          let renderedSection = mustachesRender(originText, data, formatters);
          try {
            // eslint-disable-next-line no-eval
            renderedSection = String(eval(renderedSection));
            return {
              replaceAllText: {
                replaceText: renderedSection,
                containsText: {
                  text: srcSection,
                  matchCase: false
                }
              }
            };
          } catch (err) {
            console.log("eval error", err);
          }
        } else {
          return {
            replaceAllText: {
              replaceText: "",
              containsText: {
                text: srcSection,
                matchCase: false
              }
            }
          };
        }

        return;
      }
    )
  );

  const replacements = await Promise.all(
    placeholders.map(
      async (placeholder): Promise<[string, string]> => {
        let computed: any;

        computed = await getComputedValue(
          placeholder,
          data,
          formatters,
          resolver
        );

        return [placeholder, `${computed}`];
      }
    )
  );

  let placeholderUpdates = await Promise.all(
    replacements.map(([placeholder, computed]) => {
      if (computed === placeholder) computed = "";
      if (computed == "NaN") computed = "";

      return {
        replaceAllText: {
          replaceText: computed,
          containsText: {
            text: `{{${placeholder}}}`,
            matchCase: false
          }
        }
      };
    })
  );

  placeholderUpdates = placeholderUpdates.filter(request => {
    if (!request) return false;
    return true;
  });

  mFunctionUpdates = mFunctionUpdates.filter(request => {
    if (!request) return false;
    return true;
  });

  return [...mFunctionUpdates, ...placeholderUpdates];
};

export default interpolate;
