-- CreateTable
CREATE TABLE "SurveyResponseAnswer" (
    "id" TEXT NOT NULL,
    "surveyResponseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionType" "SurveyQuestionType" NOT NULL,
    "answerText" TEXT,
    "selectedOptionId" TEXT,
    "selectedOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ratingValue" INTEGER,
    "booleanValue" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyResponseAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponseAnswer_surveyResponseId_questionId_key" ON "SurveyResponseAnswer"("surveyResponseId", "questionId");

-- CreateIndex
CREATE INDEX "SurveyResponseAnswer_surveyResponseId_idx" ON "SurveyResponseAnswer"("surveyResponseId");

-- CreateIndex
CREATE INDEX "SurveyResponseAnswer_questionId_idx" ON "SurveyResponseAnswer"("questionId");

-- CreateIndex
CREATE INDEX "SurveyResponseAnswer_questionType_idx" ON "SurveyResponseAnswer"("questionType");

-- CreateIndex
CREATE INDEX "SurveyResponseAnswer_selectedOptionId_idx" ON "SurveyResponseAnswer"("selectedOptionId");

-- AddForeignKey
ALTER TABLE "SurveyResponseAnswer" ADD CONSTRAINT "SurveyResponseAnswer_surveyResponseId_fkey" FOREIGN KEY ("surveyResponseId") REFERENCES "SurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponseAnswer" ADD CONSTRAINT "SurveyResponseAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
