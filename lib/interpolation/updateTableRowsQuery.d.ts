import { GDoc, Request } from "./types";
declare const updateTableRowsQuery: (doc: GDoc, data: any, resolver?: Function | undefined) => Promise<Request[]>;
export default updateTableRowsQuery;
