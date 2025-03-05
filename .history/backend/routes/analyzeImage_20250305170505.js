const express = require('express');
const { OpenAI } = require('openai');
const { spawn } = require('child_process');
const router = express.Router();

// init openai
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// handle POST requests
router.post('/analyze', async (req, res) => {
  
  // deconstruct
  const { imageBase64, lat, lng } = req.body;

  // ensure all data was recieved
  if (!imageBase64 || !lat || !lng) {
    return res.status(400).json({ error: 'imageBase64, lat, and lng are required' });
  }

  // attempt to run our python script
  try {

    const pythonProcess = spawn('python3', [
      __dirname + '/../scripts/analyze_image.py',
      imageBase64,
      lat,
      lng
    ]);

    let data = '';
    let error = '';

    // collect script output data
    pythonProcess.stdout.on('data', (chunk) => {
      data += chunk.toString();
    });

    // collect script potential errors
    pythonProcess.stderr.on('data', (chunk) => {
      error += chunk.toString();
    });

    // in case we found errors
    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python process:', err);
      
      return res.status(500).json({ error: 'Failed to start analysis process' });
    });

    // handle the completion of the python script
    pythonProcess.on('close', async (code) => {
      console.log('Python process closed with code:', code);
      if (code !== 0) {
        
        console.error('Python process exited with code:', code);
        console.error('Python error output:', error);
        
        return res.status(500).json({
          error: 'Image analysis failed',
          pythonError: error
        });
      }

      try {
        // log data
        console.log('Raw Python output:', data);

        // throw error if no data was collected
        if (!data) {
          throw new Error('No data received from Python script');
        }

        // check if any json data was found
        const jsonStart = data.indexOf('{');
        if (jsonStart === -1) {
          throw new Error('No JSON data found in python output');
        }

        // slice at start (if data exists)
        const jsonString = data.slice(jsonStart);

        // parse the JSON
        const analysisResult = JSON.parse(jsonString);
        
        // final error check
        if (analysisResult.error) {
          console.error('Python script error:', analysisResult.error);
          
          return res.status(500).json({ error: analysisResult.error });
        }

        /* 
        Here we will build the query to be sent to OpenAI
        Here is an example prompt:

        Location: CityName
        Tree Coverage: 45.67%
        Trees: 123
        AQI: 50
        Main Pollutant: PM2.5
        Temp: 25°C
        Humidity: 60%
        Wind: 5 m/s
        */
        const userMessage = 
`Location: ${analysisResult.air_quality.city}
Tree Coverage: ${analysisResult.tree_cover_percent.toFixed(2)}%
Trees: ${analysisResult.num_trees}
AQI: ${analysisResult.air_quality.current.pollution.aqius}
Main Pollutant: ${analysisResult.air_quality.current.pollution.mainus}
Temp: ${analysisResult.air_quality.current.weather.tp}°C
Humidity: ${analysisResult.air_quality.current.weather.hu}%
Wind: ${analysisResult.air_quality.current.weather.ws} m/s
Based on the actual tree coverage percentage (${analysisResult.tree_cover_percent.toFixed(2)}%) and tree count (${analysisResult.num_trees}), provide 3 quick, one-sentence bullet point recommendations to improve environmental quality. Focus on actionable, specific suggestions.`;

        // log message sending
        console.log('Message sent to OpenAI:', userMessage);

        // create GPT instance
        const gptResponse = await openai.chat.completions.create({
          model: "gpt-4-turbo",
          messages: [
            {
              // prompt the system
              role: "system",
              content: "You are an environmental expert. Provide exactly 3 concise, one-sentence bullet point recommendations based on tree coverage and count. Start with 'Based on the actual tree coverage percentage and tree count:' and use this format: • [recommendation]"
            },
            {
              role: "user",
              content: userMessage
            }
          ],
          max_tokens: 10000
        });

        res.json({
          ...analysisResult,
          analysis: gptResponse.choices[0].message.content
        });
      } catch (parseError) {
        console.error('Error processing analysis results:', parseError);
        console.error('Raw Python output:', data);
        res.status(500).json({ error: 'Error processing analysis results' });
      }
    });
  } catch (error) {
    console.error("Error during analysis:", error);
    res.status(500).json({ error: "Error during analysis" });
  }
});

module.exports = router;