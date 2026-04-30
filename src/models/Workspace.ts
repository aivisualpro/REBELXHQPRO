import mongoose, { Schema, Document } from 'mongoose';

/**
 * Field-level permission: controls visibility of individual fields within a sub-module.
 * By default all fields are visible. Only hidden fields need to be tracked.
 */
export interface IFieldPermission {
    field: string;       // e.g. 'email', 'phone', 'revenue'
    label: string;       // Human-readable label
    visible: boolean;    // true = visible, false = hidden
}

/**
 * Sub-module permission: controls access to a sub-module within a module.
 * e.g. CRM → Inbox, Leads, Clients
 */
export interface ISubModulePermission {
    key: string;         // unique key e.g. 'inbox', 'leads'
    label: string;       // Display label
    route: string;       // Route path e.g. '/crm/inbox'
    enabled: boolean;    // Whether this sub-module is accessible
    crud: {
        create: boolean;
        read: boolean;
        update: boolean;
        delete: boolean;
    };
    fields: IFieldPermission[];
    settings: ISubModuleSetting[];
}

export interface ISubModuleSetting {
    key: string;         // e.g. 'visibility'
    label: string;       // e.g. 'Visibility'
    options: string[];   // e.g. ['Everybody', 'Self']
    value: string;       // current value
    default: string;     // default value
}

/**
 * Module permission: top-level module entry.
 * e.g. CRM, Sales, Warehouse, Reports, Help
 */
export interface IModulePermission {
    key: string;         // unique key e.g. 'crm', 'sales'
    label: string;       // Display label
    icon: string;        // Icon identifier for UI
    enabled: boolean;    // Whether entire module is accessible
    subModules: ISubModulePermission[];
}

export interface IWorkspace extends Document {
    name: string;
    description?: string;
    color: string;       // Theme color for visual identification
    modules: IModulePermission[];
    isDefault: boolean;  // If this is the default workspace for new users
    createdAt: Date;
    updatedAt: Date;
}

const FieldPermissionSchema = new Schema({
    field: { type: String, required: true },
    label: { type: String, required: true },
    visible: { type: Boolean, default: true },
}, { _id: false });

const SettingSchema = new Schema({
    key: { type: String, required: true },
    label: { type: String },
    options: { type: [String], default: [] },
    value: { type: String, default: '' },
    default: { type: String, default: '' },
}, { _id: false });

const SubModulePermissionSchema = new Schema({
    key: { type: String, required: true },
    label: { type: String, required: true },
    route: { type: String, required: true },
    enabled: { type: Boolean, default: false },
    crud: {
        create: { type: Boolean, default: true },
        read: { type: Boolean, default: true },
        update: { type: Boolean, default: true },
        delete: { type: Boolean, default: true },
    },
    fields: { type: [FieldPermissionSchema], default: [] },
    settings: { type: [SettingSchema], default: [] },
}, { _id: false });

const ModulePermissionSchema = new Schema({
    key: { type: String, required: true },
    label: { type: String, required: true },
    icon: { type: String, default: '' },
    enabled: { type: Boolean, default: false },
    subModules: { type: [SubModulePermissionSchema], default: [] },
}, { _id: false });

const WorkspaceSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#f2b61c' },
    modules: { type: [ModulePermissionSchema], default: [] },
    isDefault: { type: Boolean, default: false },
}, {
    timestamps: true,
});

export default mongoose.models.Workspace || mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
