# Wholesale Order Creation Improvements

## Modal UI & Logic Updates
- [ ] **Order ID**: Make read-only. Implement logic to auto-generate (Last Label + 1) or handle on backend.
- [ ] **Sales Rep**: Convert input to `SearchableSelect` populated with Users.
- [ ] **Status**: Remove field from UI. Default to 'Pending' in payload.
- [ ] **Payment Method**: Convert to Dropdown with specific Enum values (Cash, Credit Card, Check By Mail, ACH, Nothing Due, CC#, Mobile Check Deposit, Auth Payment Link, COD Check, COD, Consignment, Net Terms).
- [ ] **Category**: Remove field completely.
- [ ] **Shipping Method**: Convert to `SearchableSelect` with "creatable" option (Search & Add).
- [ ] **Address/City/State**: Auto-populate validation/onChange handler when Client is selected. Ensure fields remain editable.
- [ ] **Financials (Shipping, Discount, Tax)**: Initialize as empty string/undefined instead of `0` to avoid displaying `0`.
- [ ] **Lock Price**: Add Toggle switch.

## Line Item Modal Updates
- [ ] **Refresh Button**: Hide/Remove on the "Add Item" modal.
- [ ] **SKU Change**: specific logic to refresh `salePrice` from SKU details when SKU changes.
- [ ] **Lot Logic**: Ensure Lot # auto-populates (FIFO/logic) and remains selectable via Lot Modal.

## Backend/API
- [ ] Verify `POST` endpoint handles the "Next Label" logic if not passed, or ensure frontend calculates it correctly before sending (though backend is safer).
- [ ] Adjust schema/validation if "Category" was required.
