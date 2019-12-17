import { GDoc, Request, SPlaceholderInfo } from "./types";
declare const insertTableRowsQuery: (doc: GDoc, data: any) => {
    requests: Request[];
    specialPlaceholders: SPlaceholderInfo[];
};
export default insertTableRowsQuery;
