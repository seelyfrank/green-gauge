import sys
import json
import base64
import cv2

import numpy as np
from deepforest import main
import requests
from dotenv import load_dotenv

# init the model
model = main.deepforest()
model.use_release() # use pretrained version

# load the .env
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))


'''
This function will take in the encoded base64 image string as well as the latitude and longitude of the location in the image and return a dict
where the percent coverage, number of trees, and air quality can be found (utilizing Deepforest)
'''
def analyze_image(img_64, lat, lon):
    try:
        # add padding to the encoded image if needed
        padding = len(img_64) % 4
        if padding:
            img_64 += '=' * (4 - padding)
        
        # decode the image and convert into an array, then use cv2 to reconstruct
        img_data = base64.b64decode(img_64)
        img_arr = np.frombuffer(img_data, dtype=np.uint8)
        img = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            return {"error": "Failed to decode image"}
        
        # save the image
        temp_path = "temp_image.jpg"
        cv2.imwrite(temp_path, img)
        
        # utilize model to find the predicted number of trees
        boxes = model.predict_image(path=temp_path)
        num_trees = len(boxes)
        
        # finding the tree cover
        height, width, _ = img.shape
        total_area = height * width

        # calculate total tree area 
        tree_area = sum((row["xmax"] - row["xmin"]) * (row["ymax"] - row["ymin"]) for _, row in boxes.iterrows())
        cover = (tree_area / total_area) * 100
        
        api_key = os.getenv
        air_quality = get_air_quality(lat, lon, api_key)
        
        # return results
        return {
            "tree_cover_percent": cover,
            "num_trees": num_trees,
            "air_quality": air_quality
        }
    except Exception as e:
        print(f"Err in analyze_image: {str(e)}")
        return {"error": str(e)}

'''
simple request to the airvis API to get the relvant information using our latitude and longitiude 
returns the data from the API is successful else none
'''
def get_air_quality(lat, lon, api_key):
    url = f'https://api.airvisual.com/v2/nearest_city?lat={lat}&lon={lon}&key={api_key}'
    response = requests.get(url)
    # if successful
    if response.status_code == 200:
        data = response.json()
        return data['data'] if data['status'] == 'success' else None
    return None

# entry point
if __name__ == "__main__":
    try:
        image_base64 = sys.argv[1]
        lat = float(sys.argv[2])
        lon = float(sys.argv[3])
        
        result = analyze_image(image_base64, lat, lon)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)