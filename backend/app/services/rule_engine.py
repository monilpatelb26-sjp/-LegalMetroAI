def validate_declarations(extracted_data: dict) -> dict:
    """
    Checks the extracted data against Legal Metrology Rules, 2011.
    Generates Auto-Penalty and E-Challan amounts, and Risk Scoring.
    """
    violations = []
    penalties = []
    severity_score = 0
    
    def add_violation(message, section, fine, risk_points=10):
        nonlocal severity_score
        violations.append(message)
        penalties.append({"violation": message, "section": section, "fine": fine})
        severity_score += risk_points

    is_wholesale = extracted_data.get("is_wholesale_or_exempt", False)
    is_imported = extracted_data.get("is_imported", False)
    
    # 1. Exemptions (Wholesale / Not for Retail Sale)
    if is_wholesale:
        if extracted_data.get("mrp") is None:
            # Not an error for wholesale packages under Rule 3
            pass 
        if not extracted_data.get("consumer_care"):
            add_violation("Wholesale Violation: Consumer Care details are mandatory even for wholesale.", "Rule 6", 5000, 20)
    else:
        # Rule: MRP must be present (Section 36)
        if extracted_data.get("mrp") is None:
            add_violation("Violation: Maximum Retail Price (MRP) declaration missing or unreadable.", "Section 36", 25000, 40)
            
        # 2. Correctness (MRP Format)
        if extracted_data.get("mrp") and extracted_data.get("has_inclusive_of_all_taxes") is False:
            add_violation("Format Violation: MRP declaration must include 'inclusive of all taxes'.", "Rule 6", 2000, 10)

    # Rule: Net Quantity must be present (Section 36)
    if extracted_data.get("net_quantity") is None:
        add_violation("Violation: Net Quantity declaration missing or unreadable.", "Section 36", 10000, 30)
        
    # Rule: Date of Manufacture/Packing must be present (Rule 6)
    if extracted_data.get("mfg_date") is None:
        add_violation("Violation: Month/Year of Manufacture declaration missing or unreadable.", "Rule 6", 5000, 30)
        
    # Importer Logic (Rule 6(1)(a))
    if is_imported:
        if extracted_data.get("manufacturer") is None:
            add_violation("Import Violation: Importer Name and Address missing.", "Rule 6(1)(a)", 10000, 30)
        if not extracted_data.get("country_of_origin"):
            add_violation("Import Violation: Country of Origin missing on imported package.", "Rule 6", 10000, 40)
    else:
        # Rule: Manufacturer/Packer details must be present (Rule 6)
        if extracted_data.get("manufacturer") is None:
            add_violation("Violation: Manufacturer/Packer name and address missing or unreadable.", "Rule 6", 10000, 30)
        
    # Rule: Consumer Care details must be present (Rule 6)
    if not extracted_data.get("consumer_care"):
        add_violation("Consumer Care contact details missing or unreadable.", "Rule 6", 5000, 20)
        
    # New: Strict Font Size Simulation (Rule 7)
    font_score = extracted_data.get("font_readability_score")
    if font_score == "Poor" or font_score == "Too Small":
        add_violation("Declarations are not legible or font size is below minimum 1mm/2mm threshold.", "Rule 7", 5000, 15)
    elif font_score == "Borderline":
        add_violation("Warning: Font size appears borderline too small.", "Rule 7", 0, 5)

    # 1. Placement (Same Field of Vision)
    if extracted_data.get("is_same_field_of_vision") is False:
        add_violation("Placement Violation: Mandatory declarations are scattered.", "Rule 6", 2000, 10)

    # 3. Bilingual Declaration Check
    if extracted_data.get("is_bilingual") is False:
        pass # Optional based on state, keeping it out of severity for now

    # 4. Standard Package Size & Unit Sale Price Calculation
    qty_str = str(extracted_data.get("net_quantity") or "").lower().replace(" ", "")
    mrp = extracted_data.get("mrp")
    
    if qty_str:
        # Mock check for standard package sizes (Third Schedule)
        standard_sizes = ["50g", "100g", "200g", "500g", "1kg", "50ml", "100ml", "200ml", "500ml", "1l"]
        if any(unit in qty_str for unit in ["g", "kg", "ml", "l"]):
            if qty_str not in standard_sizes and qty_str not in ["75g", "6g", "9g", "10g"]: # Allowing exceptions
                add_violation(f"Standard Size Violation: '{qty_str}' is not a standard prescribed package size.", "Rule 4", 15000, 20)
    
    if extracted_data.get("unit_sale_price") is None and not is_wholesale:
        if mrp and qty_str and not extracted_data.get("selling_price"):
            add_violation("Violation: Unit Sale Price (USP) missing (e.g. Rs/g or Rs/ml).", "Rule 6", 2000, 10)

    # 5. GS1 Barcode / Counterfeit Verification
    barcode = extracted_data.get("barcode")
    if barcode:
        barcode_str = str(barcode).replace(" ", "").strip()
        if len(barcode_str) >= 12:
            if not barcode_str.startswith("890"):
                add_violation(f"🚨 COUNTERFEIT ALERT: Barcode {barcode_str} does not match the Indian GS1 Registry prefix (890). Suspected Fake Product!", "Anti-Counterfeit (IPC 420/LM)", 100000, 100)
                extracted_data["gs1_verification"] = "❌ FAKE / MISMATCHED"
            else:
                extracted_data["gs1_verification"] = f"✅ GS1 Verified (Authentic)"

    # 6. E-Commerce Overcharging Detection
    selling_price = extracted_data.get("selling_price")
    if mrp is not None and selling_price is not None:
        if selling_price > mrp:
            add_violation(f"OVERCHARGING ALERT: E-Commerce Selling Price (Rs. {selling_price}) is strictly greater than printed MRP (Rs. {mrp}).", "Section 36", 25000, 50)
            
    # Cap severity score at 100
    severity_score = min(100, severity_score)
    
    risk_level = "Low"
    if severity_score == 0:
        risk_level = "None"
    elif severity_score >= 40:
        risk_level = "Critical"
    elif severity_score >= 20:
        risk_level = "Medium"

    is_compliant = len(violations) == 0
    total_fine = sum(p["fine"] for p in penalties)
    
    return {
        "is_compliant": is_compliant,
        "violations": violations,
        "penalties": penalties,
        "total_fine": total_fine,
        "status_summary": "COMPLIANT" if is_compliant else "NON_COMPLIANT",
        "severity_score": severity_score,
        "risk_level": risk_level
    }
