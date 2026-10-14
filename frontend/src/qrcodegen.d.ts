export namespace qrcodegen {
  export class QrCode {
    public static readonly MIN_VERSION: number;
    public static readonly MAX_VERSION: number;
    public static readonly Ecc: {
      readonly LOW: QrCode.Ecc;
      readonly MEDIUM: QrCode.Ecc;
      readonly QUARTILE: QrCode.Ecc;
      readonly HIGH: QrCode.Ecc;
    };
    public readonly size: number;
    public readonly version: number;
    public readonly mask: number;
    public static encodeText(text: string, ecl: QrCode.Ecc): QrCode;
    public static encodeBinary(data: ReadonlyArray<number>, ecl: QrCode.Ecc): QrCode;
    public getModule(x: number, y: number): boolean;
  }
  export namespace QrCode {
    export class Ecc {
      public static readonly LOW: Ecc;
      public static readonly MEDIUM: Ecc;
      public static readonly QUARTILE: Ecc;
      public static readonly HIGH: Ecc;
      public readonly ordinal: number;
      public readonly formatBits: number;
    }
  }
  export class QrSegment {
    public static makeBytes(data: ReadonlyArray<number>): QrSegment;
    public static makeNumeric(digits: string): QrSegment;
    public static makeAlphanumeric(text: string): QrSegment;
    public static makeSegments(text: string): QrSegment[];
    public static makeEci(assignVal: number): QrSegment;
  }
}

export const QrCode: typeof qrcodegen.QrCode;
export const QrSegment: typeof qrcodegen.QrSegment;
export default qrcodegen;
