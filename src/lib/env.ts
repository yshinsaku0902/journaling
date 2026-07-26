// デモモード判定: Azure(Entra ID)の資格情報が無ければデモモード。
// デモモードでは「ログイン不要 / ローカルファイル保存 / Outlookはサンプル予定」で動く。
export const DEMO_MODE = !process.env.AZURE_AD_CLIENT_ID;
