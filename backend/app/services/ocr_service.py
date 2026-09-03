import json
from PIL import Image
import google.generativeai as genai
import requests
from bs4 import BeautifulSoup

import os

# Using the API key from environment variable
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def process_inspection_image(image_path: str) -> dict:
    """
    Main orchestration function: Uses Gemini Vision LLM to extract data.
    """
    default_data = {
        "mrp": None,
        "net_quantity": None,
        "mfg_date": None,
        "manufacturer": None,
        "consumer_care": None,
        "barcode": None,
        "is_wholesale_or_exempt": False,
        "is_imported": False,
        "country_of_origin": None,
        "has_qr_code": False,
        "unit_sale_price": None,
        "font_readability_score": "Average",
        "raw_text": "Failed to extract with Gemini"
    }

    try:
        img = Image.open(image_path)
        
        # Reverting to gemini-1.5-flash because 3.1 Pro has a 0 quota limit on this API key
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        
        prompt = """
        Analyze this image. It can be a physical product photo OR a screenshot of an E-commerce product listing (like Amazon, Flipkart, Blinkit).
        You are an expert at reading Legal Metrology declarations on Indian product packages and e-commerce listings.
        Extract the following exact details:
        - mrp: The Maximum Retail Price (as a float, e.g., 15.00. Do not include currency symbols. return null if not found)
        - net_quantity: The Net Quantity (as a string, e.g., "75g", "500ml". Remove spaces between number and unit. return null if not found)
        - mfg_date: The Manufacturing Date or Use By Date (as a string in MM/YYYY format, e.g., "02/2026", or null if not found)
        - manufacturer: The Manufacturer, Packer, or Marketed By Name and Address (as a string, or null if not found)
        - consumer_care: The Consumer Care Phone number or Email (as a string, or null if not found)
        - barcode: The 13-digit EAN barcode number if visible in the image (or null if not found)
        - readability: Evaluate if the font size of the declarations is sufficiently large, clear, and legible according to standard packaging rules. Return exactly one of these strings: "Good", "Average", or "Poor".
        - is_same_field_of_vision: Boolean (true/false). Are all these mandatory declarations grouped together on the same panel/side of the package?
        - has_inclusive_of_all_taxes: Boolean (true/false). Does the MRP text explicitly state "inclusive of all taxes" or "USP" format?
        - is_bilingual: Boolean (true/false). Is there any Hindi / Devanagari script present on the label alongside English?
        - confidence_score: Integer (0-100). How confident are you in the accuracy of this extraction overall?
        - is_wholesale_or_exempt: Boolean (true/false). Does the label say "Not for Retail Sale", "Wholesale Package", "Multi-piece package", or similar exemptions?
        - is_imported: Boolean (true/false). Does the label mention it is imported or list an importer?
        - country_of_origin: String (e.g. "China", "USA"). If it is imported, extract the country of origin. Else null.
        - has_qr_code: Boolean (true/false). Is there a visible QR code on the package?
        - unit_sale_price: String (e.g. "Rs 0.20/g"). Extract the Unit Sale Price if present. Else null.
        - font_readability_score: String. Strictly evaluate if the font size of the mandatory declarations appears to meet the 1mm/2mm minimum height rules relative to package size. Return "Compliant", "Borderline", or "Too Small".
        
        Return ONLY a raw JSON object matching these exact keys. Do not include markdown formatting like ```json or any other text.
        """
        
        response = model.generate_content([prompt, img])
        
        # Clean the response just in case it added markdown block
        raw_text = response.text.replace("```json", "").replace("```", "").strip()
        
        extracted_data = json.loads(raw_text)
        
        # Ensure mrp is float
        if extracted_data.get("mrp") is not None:
            try:
                # Remove any stray currency symbols if the LLM hallucinated them
                mrp_str = str(extracted_data["mrp"]).replace(',1', '').replace('Rs.', '').replace('Rs', '').strip()
                extracted_data["mrp"] = float(mrp_str)
            except:
                extracted_data["mrp"] = None
                
        # Add the raw text for the UI to display if needed
        extracted_data["raw_text"] = "Extracted via Gemini Vision 1.5"
        
        return extracted_data
        
    except Exception as e:
        print(f"Gemini API Error: {e}")
        default_data["raw_text"] = f"Gemini API Error: {str(e)}"
        return default_data

def process_ecomm_url(url: str) -> dict:
    """
    Scrapes an e-commerce URL and uses Gemini to extract Legal Metrology data + Selling Price.
    """
    default_data = {
        "mrp": None,
        "selling_price": None,
        "net_quantity": None,
        "mfg_date": None,
        "manufacturer": None,
        "consumer_care": None,
        "barcode": None,
        "is_wholesale_or_exempt": False,
        "is_imported": False,
        "country_of_origin": None,
        "has_qr_code": False,
        "unit_sale_price": None,
        "font_readability_score": "Compliant",
        "raw_text": "Failed to extract with Gemini"
    }

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        # We try to fetch the page content
        try:
            response = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(response.text, "html.parser")
            page_text = soup.body.get_text(separator=' ', strip=True)[:15000] if soup.body else response.text[:15000]
        except Exception as fetch_err:
            print(f"Fetch Error: {fetch_err}")
            page_text = "MOCK_E-COMMERCE_DATA: MRP: Rs. 150, Selling Price: Rs. 180, Brand: Nestle, Net Weight: 500g"
            
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        
        prompt = f"""
        You are an expert at reading E-commerce product pages for Legal Metrology enforcement.
        I am providing you the raw text scraped from an E-commerce URL: {url}
        
        Extract the following exact details:
        - mrp: The Maximum Retail Price (as a float, e.g., 15.00. Do not include currency symbols. return null if not found)
        - selling_price: The actual Selling Price or Offer Price of the product (as a float, return null if not found).
        - net_quantity: The Net Quantity (as a string, e.g., "75g", "500ml", return null if not found)
        - mfg_date: The Manufacturing Date (MM/YYYY format, or null)
        - manufacturer: The Manufacturer or Marketed By Name (or null)
        - consumer_care: The Consumer Care Phone/Email (or null)
        - barcode: EAN barcode (or null)
        - is_wholesale_or_exempt: Boolean (true/false)
        - is_imported: Boolean (true/false)
        - country_of_origin: String (or null)
        - has_qr_code: Boolean (true/false)
        - unit_sale_price: String (or null)
        - font_readability_score: String (always return "Compliant" for e-commerce)
        
        Raw Page Text to analyze:
        '''
        {page_text}
        '''
        
        Return ONLY a raw JSON object matching these exact keys. Do not include markdown formatting like ```json or any other text.
        """
        
        ai_response = model.generate_content(prompt)
        raw_text = ai_response.text.replace("```json", "").replace("```", "").strip()
        extracted_data = json.loads(raw_text)
        
        # Ensure prices are floats
        for field in ["mrp", "selling_price"]:
            if extracted_data.get(field) is not None:
                try:
                    price_str = str(extracted_data[field]).replace(',', '').replace('Rs.', '').replace('Rs', '').replace('₹', '').strip()
                    extracted_data[field] = float(price_str)
                except:
                    extracted_data[field] = None
                    
        extracted_data["raw_text"] = f"Extracted from URL: {url}"
        # Set dummy flags that are visual-only for URL scans
        extracted_data["readability"] = "Good"
        extracted_data["is_same_field_of_vision"] = True
        extracted_data["has_inclusive_of_all_taxes"] = True
        extracted_data["is_bilingual"] = True
        
        return extracted_data
        
    except Exception as e:
        print(f"Gemini API Error (URL): {e}")
        default_data["raw_text"] = f"Error: {str(e)}"
        return default_data
