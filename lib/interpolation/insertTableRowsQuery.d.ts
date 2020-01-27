import { GDoc, Request } from "./types";
declare const insertTableRowsQuery: (doc: GDoc, data: any, resolver?: Function | undefined) => Promise<Request[]>;
export default insertTableRowsQuery;
