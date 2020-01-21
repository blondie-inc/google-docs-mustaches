"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
exports.default = (data, interpolation, options) => {
    const [path, ...transformations] = interpolation
        .split("|")
        .map(s => s.trim());
    const iterative = [];
    path.split(".").map(subPath => {
        const selector = subPath.match(/\[.*\]/);
        if (selector) {
            subPath = subPath.replace(selector[0], "");
            iterative.push(subPath);
            iterative.push(selector[0].slice(1, -1));
        }
        else {
            iterative.push(subPath);
        }
    });
    let prop = iterative.reduce((acc, accessor) => {
        if (acc[accessor])
            return acc[accessor];
        return accessor;
    }, data);
    if (options && options.formatters) {
        transformations.map(transformation => {
            const paramParts = transformation.match(/\((.*)\)/gi) || [];
            if (!paramParts.length) {
                const formatter = options.formatters[transformation.toLowerCase()];
                if (formatter) {
                    prop = formatter(prop);
                }
            }
            else {
                const filterName = transformation.slice(0, transformation.indexOf("("));
                const filterFunc = options.formatters[filterName];
                if (filterFunc) {
                    let params = transformation
                        .slice(transformation.indexOf("(") + 1, -1)
                        .split(",")
                        .map(s => {
                        s = s.trim();
                        if (s && letters.includes(s[0]))
                            return s;
                        return s.slice(1, -1);
                    });
                    params = params.map(param => {
                        if (data[param])
                            return data[param];
                        return param;
                    });
                    prop = filterFunc(prop, ...params);
                }
            }
        });
    }
    return prop;
};
