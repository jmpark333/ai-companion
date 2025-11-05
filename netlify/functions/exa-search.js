const fetch = require('node-fetch');

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { query, numResults = 5, includeDomains, excludeDomains, startPublishedDate, endPublishedDate, category } = JSON.parse(event.body);
    const apiKey = process.env.EXA_API_KEY;

    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ error: 'EXA_API_KEY is not set in environment variables.' }) };
    }

    try {
        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
            },
            body: JSON.stringify({
                query,
                numResults,
                includeDomains,
                excludeDomains,
                startPublishedDate,
                endPublishedDate,
                category,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`EXA API Error: ${response.status}`, errorBody);
            return { statusCode: response.status, body: JSON.stringify({ error: `EXA API Error: ${errorBody}` }) };
        }

        const data = await response.json();
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error('Error proxying Exa API request:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch from Exa API.' }),
        };
    }
};
