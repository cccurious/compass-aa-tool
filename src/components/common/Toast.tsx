/** 画面上部に一瞬出る通知。useToast とセットで使う */
export const Toast = ({ message }: { message: string }) => (
    <div className={`toast ${message ? 'show' : ''}`}>{message}</div>
);
