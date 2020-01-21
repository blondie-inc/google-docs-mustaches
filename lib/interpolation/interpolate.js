"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dot_1 = require("./dot");
const interpolate = async (doc, data, formatters, resolver) => {
    const { placeholders, sections } = scanDoc(doc);
    return computeUpdates(sections, placeholders, data, formatters, resolver);
};
const scanDoc = (doc) => {
    const placeholders = [];
    const sections = [];
    const processContent = (content) => {
        content.map(c => {
            if (c.paragraph) {
                c.paragraph.elements.map((e) => {
                    if (e.textRun) {
                        const placeholderMatches = e.textRun.content.match(/{{([^}#/]*)}}/gi) || [];
                        placeholderMatches.map((m) => placeholders.push(m.slice(2, -2)));
                        const sectionMatches = e.textRun.content.match(/{{#([^}]*)}}.+{{\/([^}]*)}}/gi) || [];
                        sectionMatches.map((section) => sections.push(section));
                    }
                });
            }
            if (c.table) {
                c.table.tableRows.map((r) => {
                    r.tableCells.map((c) => {
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
const availableFormatters = {
    lowercase: (s) => s.toLowerCase(),
    uppercase: (s) => s.toUpperCase()
};
const getComputedValue = async (placeholder, data, formatters, resolver) => {
    let computed;
    try {
        computed = dot_1.default(data, placeholder, { formatters });
        if (!computed && resolver) {
            computed = await resolver(placeholder);
        }
    }
    catch (e) {
        if (resolver) {
            computed = await resolver(placeholder);
        }
    }
    return computed || "";
};
const getComputedValueSync = (placeholder, data, formatters) => {
    let computed;
    computed = dot_1.default(data, placeholder, { formatters });
    return computed || "";
};
const mustachesRender = (originText, data, formatters) => {
    const placeholders = originText.match(/{{([^}#/]*)}}/gi) || [];
    return placeholders.reduce((result, placeholder) => {
        const computed = getComputedValueSync(placeholder.slice(2, -2), data, formatters);
        result = result.replace(placeholder, computed);
        return result;
    }, originText);
};
const computeUpdates = async (sections, placeholders, data, formatters, resolver) => {
    formatters = Object.assign({}, availableFormatters, formatters);
    const mFunctionUpdates = await Promise.all(sections.map(async (section) => {
        const srcSection = section;
        const sectionName = section.slice(3, section.indexOf("}}"));
        if (typeof data[sectionName] === "function") {
            const converter = data[sectionName]();
            const originText = section.slice(section.indexOf("}}") + 2, section.lastIndexOf("{{"));
            let renderedSection = converter(originText, function (text) {
                return mustachesRender(text, data, formatters);
            });
            if (sectionName === "eval") {
                try {
                    renderedSection = String(eval(renderedSection));
                }
                catch (err) {
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
        }
        else if (sectionName === "eval") {
            const originText = section.slice(section.indexOf("}}") + 2, section.lastIndexOf("{{"));
            let renderedSection = mustachesRender(originText, data, formatters);
            try {
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
            }
            catch (err) {
                console.log("eval error", err);
            }
        }
        return;
    }));
    const replacements = await Promise.all(placeholders.map(async (placeholder) => {
        let computed;
        computed = await getComputedValue(placeholder, data, formatters, resolver);
        return [placeholder, `${computed}`];
    }));
    const placeholderUpdates = await Promise.all(replacements.map(([placeholder, computed]) => {
        return {
            replaceAllText: {
                replaceText: computed,
                containsText: {
                    text: `{{${placeholder}}}`,
                    matchCase: false
                }
            }
        };
    }));
    return [...mFunctionUpdates, ...placeholderUpdates];
};
exports.default = interpolate;
