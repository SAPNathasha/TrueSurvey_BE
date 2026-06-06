export type IdentityVerificationJobData = {
  userId: string;
  nicNumber: string;
  documentImageUrl: string;
  selfieImageUrl: string;
};

export type IdentityVerificationServiceResponse = {
  userId: string;
  nicNumber: string;
  verificationStatus: string;
  faceMatched: boolean;
  nicMatched: boolean;
  extractedNicNumber: string | null;
  distance: number | null;
  threshold: number | null;
  modelName: string | null;
  detectorBackend: string | null;
  reason: string | null;
};
