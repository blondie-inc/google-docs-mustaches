import { GDoc, Request } from "./types";
import { Formatters } from "../types";

import dot from "./dot";

const interpolate = async (
  doc: GDoc,
  data: any,
  formatters: Formatters,
  resolver?: Function
): Promise<Request[]> => {
  console.log("doc123", doc);
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

const mustachesRender = (
  originText: string,
  data: any,
  formatters: Formatters,
  resolver?: Function
): string => {
  const placeholders = originText.match(/{{([^}#/]*)}}/gi) || [];

  return placeholders.reduce((result, placeholder) => {
    getComputedValue(placeholder.slice(2, -2), data, formatters, resolver).then(
      computed => {
        result = result.replace(placeholder, computed);
      }
    );

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

  const mFunctionUpdates = await Promise.all(
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
          const renderedSection = converter(originText, function(text: any) {
            return mustachesRender(text, data, formatters, resolver);
          });

          return {
            replaceAllText: {
              replaceText: renderedSection,
              containsText: {
                text: srcSection,
                matchCase: false
              }
            }
          };
        }
        
        return ["", ""];
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

  const placeholderUpdates = await Promise.all(
    replacements.map(([placeholder, computed]) => {
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

  return [...mFunctionUpdates, ...placeholderUpdates];
};

export default interpolate;
