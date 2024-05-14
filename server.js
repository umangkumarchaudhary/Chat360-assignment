const express = require('express');
const cors = require('cors');
const fs = require('fs');
const morgan = require('morgan');
const path = require('path');
const Joi = require('joi'); // For data validation
const winston = require('winston');
const readline = require('readline'); 

const app = express();
const port = 3001;

// Utility functions (make sure these are implemented)
const { createFile, createFolder } = require("./utils");

// Set up logging with winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logfile.log' })
  ],
});

// Middleware for logging requests with morgan
app.use(morgan('dev'));

// Enable CORS for all routes
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API for logging
app.post('/log/:source', (req, res) => {
    const schema = Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug').required(),
        log_string: Joi.string().required(),
    });

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const { level, log_string } = req.body;
    const source = req.params.source;
    const timestamp = new Date().toISOString();

    // Log to file
    const logData = {
        level,
        log_string,
        timestamp,
        metadata: {
            source: `${source}.log`
        }
    };
    const logFilePath = `logs/${source}.log`;

    try {
        createFolder('logs'); // Ensure the logs folder exists
        createFile(logFilePath); // Ensure the log file exists
        fs.appendFileSync(logFilePath, JSON.stringify(logData) + '\n');
        logger.info('Log written successfully');
        res.sendStatus(200);
    } catch (err) {
        logger.error('Error writing log:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Search functionality with streaming and error handling
app.get('/search', (req, res) => {
    const schema = Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug'),
        log_string: Joi.string(),
        start: Joi.string().isoDate(),
        end: Joi.string().isoDate(),
        source: Joi.string(),
    });

    const { error } = schema.validate(req.query);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const { level, log_string, start, end, source } = req.query;
    const logFolderPath = path.join(__dirname, 'logs');

    try {
        const logFiles = fs.readdirSync(logFolderPath)
            .filter(file => file.endsWith('.log'));

        const logs = [];

        logFiles.forEach(file => {
            const logFilePath = path.join(logFolderPath, file);
            const stream = fs.createReadStream(logFilePath, 'utf8');
            const rl = readline.createInterface({
                input: stream,
                crlfDelay: Infinity
            });

            rl.on('line', (line) => {
                if (line.trim() !== '') {
                    const log = JSON.parse(line);
                    const logTimestamp = new Date(log.timestamp).getTime();

                    // Check if log matches search criteria
                    const isLogMatched = (!level || log.level === level) &&
                                         (!log_string || log.log_string.includes(log_string)) &&
                                         (!start || new Date(start).getTime() <= logTimestamp) &&
                                         (!end || new Date(end).getTime() >= logTimestamp) &&
                                         (!source || (log.metadata && log.metadata.source === source));

                    if (isLogMatched) {
                        logs.push(log);
                }
            }
            }).on('close', () => {
                // All lines are read, file is closed now.
                res.json(logs);
            });
        });
    } catch (err) {
        logger.error("Error reading log files:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server started at ${port}`);
});
