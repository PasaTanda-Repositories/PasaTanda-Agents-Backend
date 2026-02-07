export interface PaybeSignatureData {
  gasOwner: string;
  bytes: string;
  signature: string;
}

export interface PaybeStandardResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
