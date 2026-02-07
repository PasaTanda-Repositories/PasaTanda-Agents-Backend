export interface EnokiZkProofPayload {
  proofPoints: string[] | null;
  issBase64Details: string | null;
  headerBase64: string | null;
  addressSeed: string;
  [key: string]: unknown;
}

export interface EnokiZkProofResponse {
  data: EnokiZkProofPayload;
}
