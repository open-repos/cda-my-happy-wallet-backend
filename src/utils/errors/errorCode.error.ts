export class ErrorCode {
    public static readonly Unauthenticated = 'Unauthenticated';
    public static readonly WrongParamsID = 'WrongParamsID';
    public static readonly IncompleteRequestBody = 'IncompleteRequestBody';
    public static readonly IncompleteRequestCookie= "IncompleteRequestCookie";
    public static readonly NotFound = 'NotFound';
    public static readonly EmailPasswordNotValid = 'EmailPasswordNotValid';
    public static readonly EmailNotFound = 'EmailNotFound';
    public static readonly Unauthorized="Unauthorized";
    public static readonly AccessForbidden = 'AccessForbidden';
    public static readonly EmailAlreadyTaken = 'EmailAlreadyTaken';
    public static readonly AsyncError = 'AsyncError';
    public static readonly UnknownError = 'UnknownError';
    public static readonly PrismaError = 'PrismaError';
    public static readonly SendEmaillError = 'SendEmaillError';
    public static readonly InvalidInput = 'InvalidInput';
    public static readonly TooManyRequests = 'TooManyRequests';
    public static readonly PayloadTooLarge = 'PayloadTooLarge';
  }
