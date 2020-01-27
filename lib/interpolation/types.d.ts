export interface GDoc {
    headers: {
        [key: string]: Header;
    };
    body: Body;
}
export interface Header {
    content: StructuralElement[];
}
export interface Body {
    content: StructuralElement[];
}
export interface StructuralElement {
    paragraph?: Paragraph;
}
export interface Paragraph {
    elements: ParagraphElement[];
}
export interface ParagraphElement {
    textRun?: TextRun;
}
export interface TextRun {
    content: string;
}
export interface Request {
    replaceAllText?: ReplaceAllTextRequest;
    insertTableRow?: InsertTableRowRequest;
    insertText?: InsertTextRequest;
    updateTextStyle?: UpdateTextStyleRequest;
    deleteTableRow?: DeleteTableRowRequest;
    deleteContentRange?: DeleteContentRangeRequest;
}
export interface ReplaceAllTextRequest {
    replaceText: string;
    containsText: SubstringMatchCriteria;
}
export interface SubstringMatchCriteria {
    text: string;
    matchCase: boolean;
}
export interface InsertTableRowRequest {
    tableCellLocation: TableCellLocation;
    insertBelow: boolean;
}
export interface TableCellLocation {
    tableStartLocation: Location;
    rowIndex: number;
    columnIndex?: number;
}
export interface Location {
    segmentId?: string;
    index: number;
}
export interface SPlaceholderInfo {
    startRow: number;
    endRow: number;
    placeholder: string;
    tableIndex: number;
}
export interface InsertTextRequest {
    text: string;
    location: Location;
}
export interface UpdateTextStyleRequest {
    textStyle: any;
    fields?: string;
    range: Range;
}
export interface Range {
    segmentId?: string;
    startIndex: number;
    endIndex: number;
}
export interface DeleteTableRowRequest {
    tableCellLocation: TableCellLocation;
}
export interface DeleteContentRangeRequest {
    range: Range;
}
