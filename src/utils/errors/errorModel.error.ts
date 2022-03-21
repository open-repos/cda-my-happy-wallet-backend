export class ErrorModel {
    /**
     * Unique error name which identifies the error.
     */
    public name: string;
    /**
     * Status code of the error.
     */
    public status: number;
    /**
     * Any additional data that is required for translation.
     */
    public message?:string;
    public metaData?: any;

    public stack?: string;
  }
  