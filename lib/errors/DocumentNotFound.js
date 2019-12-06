"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DocumentNotFound extends Error {
    constructor() {
        super(...arguments);
        this.name = "DocumentNotFound";
    }
}
exports.default = DocumentNotFound;
