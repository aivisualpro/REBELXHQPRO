import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRecipeLineItem {
    sku: string;
    qty: number;
    uom: string;
    createdBy?: mongoose.Types.ObjectId | string;
    createdAt: Date;
    _id?: string;
}

export interface IRecipeStep {
    step: string;
    description: string;
    details?: string;
    createdBy?: mongoose.Types.ObjectId | string;
    createdAt: Date;
    _id?: string;
}

export interface IRecipe extends Omit<Document, '_id'> {
    _id: string;
    name: string;
    sku: string;
    qty: number;
    uom?: string;
    createdBy?: mongoose.Types.ObjectId | string;
    createdAt: Date;
    lineItems: IRecipeLineItem[];
    steps: IRecipeStep[];
    notes?: string;
}

const RecipeLineItemSchema = new Schema<IRecipeLineItem>({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    sku: { type: String, ref: 'Sku', required: true },
    qty: { type: Number, required: true },
    uom: { type: String, required: true },
    createdBy: { type: String, ref: 'RXHQUsers' },
    createdAt: { type: Date, default: Date.now }
});

const RecipeStepSchema = new Schema<IRecipeStep>({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    step: { type: String, required: true },
    description: { type: String, required: true },
    details: { type: String },
    createdBy: { type: String, ref: 'RXHQUsers' },
    createdAt: { type: Date, default: Date.now }
});

const RecipeSchema = new Schema<IRecipe>({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    name: { type: String, required: true },
    sku: { type: String, ref: 'Sku', required: true },
    qty: { type: Number, required: true },
    uom: { type: String, required: false },
    createdBy: { type: String, ref: 'RXHQUsers' },
    createdAt: { type: Date, default: Date.now },
    lineItems: [RecipeLineItemSchema],
    steps: [RecipeStepSchema],
    notes: { type: String }
}, {
    timestamps: true
});

// Prevent model overwrite
export const Recipe: Model<IRecipe> = mongoose.models.Recipe || mongoose.model<IRecipe>('Recipe', RecipeSchema);
