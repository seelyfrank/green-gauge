import sys
import json
import base64
import io
from PIL import Image
import numpy as np
from imageanalysis import analyze_image 

'''
convert string to numpy array in base64
'''
def base64_to_image_array(b64_string):
    image_data = base64.b64decode(b64_string)
    image = Image.open(io.BytesIO(image_data))
    return np.array(image)

if __name__ == "__main__":
    # base64 image should be passed as first argument
    if len(sys.argv) < 2:
        print(json.dumps({"error": "no image data "}))
        # quit
        sys.exit(1)
    # get image
    image_base64 = sys.argv[1]
    try:
        image_array = base64_to_image_array(image_base64)

        # analyze the image
        analyzed_image, greenspace_percentage = analyze_image(image_array)

        # return the result as a json formatted string
        result = {
            "analyzedImage": analyzed_image,  # processed image as base64 string
            "greenspace_percentage": greenspace_percentage
        }
        print(json.dumps(result))
    # catch any error
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1) 