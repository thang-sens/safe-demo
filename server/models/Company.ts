import mongoose, { Schema, Document } from "mongoose";

export interface ICompany extends Document {
  name: string;
  safeAddress: string;
  owners: string[];
  threshold: number;
  createdAt: Date;
}

const CompanySchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  safeAddress: { type: String, required: true },
  owners: [{ type: String, required: true }],
  threshold: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Create index on name for faster lookups
CompanySchema.index({ name: 1 });

export default mongoose.model<ICompany>("Company", CompanySchema);
