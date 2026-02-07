import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRecipeLineItem {
    sku: string;
    qty: number;
    uom: string;
    createdBy?: string;
    createdAt: Date;
}

export interface IRecipeStep {
    step: string;
    description: string;
    details?: string;
    createdBy?: string;
    createdAt: Date;
}

export interface IRecipe extends Document {
    legacyId?: string;
    name: string;
    sku: string;
    qty: number;
    uom?: string;
    createdBy?: string;
    createdAt: Date;
    lineItems: IRecipeLineItem[];
    steps: IRecipeStep[];
    notes?: string;
}

const RecipeLineItemSchema = new Schema<IRecipeLineItem>({
    // _id auto-generated as ObjectId
    sku: { type: String, ref: 'Sku', required: true },
    qty: { type: Number, required: true },
    uom: { type: String },
    createdBy: { type: String, ref: 'RXHQUsers' },
    createdAt: { type: Date, default: Date.now }
});

const RecipeStepSchema = new Schema<IRecipeStep>({
    // _id auto-generated as ObjectId
    step: { type: String, required: true },
    description: { type: String },
    details: { type: String },
    createdBy: { type: String, ref: 'RXHQUsers' },
    createdAt: { type: Date, default: Date.now }
});

const RecipeSchema = new Schema<IRecipe>({
    // _id auto-generated as ObjectId
    legacyId: { type: String, index: true, sparse: true },
    name: { type: String, required: true },
    sku: { type: String, ref: 'Sku', required: true },
    qty: { type: Number, required: true },
    uom: { type: String },
    createdBy: { type: String, ref: 'RXHQUsers' },
    createdAt: { type: Date, default: Date.now },
    lineItems: [RecipeLineItemSchema],
    steps: [RecipeStepSchema],
    notes: { type: String }
});

// Force schema refresh on hot reload
if (mongoose.models.Recipe) {
    delete mongoose.models.Recipe;
}
export const Recipe: Model<IRecipe> = mongoose.model<IRecipe>('Recipe', RecipeSchema);
