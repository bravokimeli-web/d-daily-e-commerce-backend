declare module "multer-storage-cloudinary" {
  import { StorageEngine } from "multer";
  import { v2 as cloudinary } from "cloudinary";

  interface CloudinaryStorageOptions {
    cloudinary: typeof cloudinary;
    folder?: string;
    format?: string | ((req: any, file: any) => string);
    public_id?: (req: any, file: any) => string;
    params?:
      | {
          folder?: string;
          resource_type?: string;
          public_id?: string;
          [key: string]: any;
        }
      | ((
          req: any,
          file: any,
          callback: (error: any, params: any) => void
        ) => void);
  }

  class CloudinaryStorage implements StorageEngine {
    constructor(options: CloudinaryStorageOptions);
    _handleFile(
      req: any,
      file: any,
      callback: (error: Error | null, info?: any) => void
    ): void;
    _removeFile(req: any, file: any, callback: (error: Error | null) => void): void;
  }

  export = CloudinaryStorage;
}
