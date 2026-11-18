require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const nodemailer = require("nodemailer");
const app = express();
app.use(express.json());
app.use(express.static("public"));


//===============mysql email connection================//

const db = mysql.createConnection({
	port:process.env.DB_PORT,
	host:process.env.DB_HOST,
	password:process.env.DB_PASSWORD,
	user:process.env.DB_USER,
	database:process.env.DB_DATABASE,
	
	
});
      db.connect((error)=>{
	if(error){
		console.error("failed to connect to mysql",error);
	}
	else{
console.log("mysql connected successful");
	}
	  })

const transport =nodemailer.createTransport({
	host:"smtp-relay.brevo.com",
	port:587,
	secure:false,
	auth:{
		user:process.env.BREVO_USER,
		pass:process.env.BREVO_PASS
	}
});
transport.verify()
  .then(() => console.log("SMTP ready"))
  .catch(e => console.error("SMTP error:", e.message));



app.post("/form/v2",async(req,res)=>{
	const fname = String(req.body.fname || "").trim();
	const fsurname = String(req.body.fsurname || "").trim();
	const femail = String(req.body.femail || "").trim();
	const fphone = String(req.body.fphone || "").trim();

	if(!fname || !fsurname || !femail || !fphone){
		return res.status(400).json({ message:"please fill all the boxes" });
	}

	try{
		const sql = `INSERT INTO users(fname,fsurname,femail,fphone) VALUES(?,?,?,?)`;

		// save in mysql (old rows stay safe, they just have NULL in fphone)
		await db.promise().query(sql,[fname,fsurname,femail,fphone]);

		// email me the chosen device
		await transport.sendMail({
			from: process.env.EMAIL_FROM,
			replyTo: femail,
			to: process.env.USER_EMAIL,
			subject: `New interest: ${fphone}`,
			text: `Chosen device: ${fphone}
Name: ${fname}
Surname: ${fsurname}
Email: ${femail}`
		});

		res.status(201).json({ message:`Thank you ${fname}! Your interest in ${fphone} was received.` });
	}
	catch(error){
		console.error(error);
		if(error.code === "ER_DUP_ENTRY"){
			return res.status(409).json({ message:"this email is already registered" });
		}
		res.status(500).json({ message:"Server error" });
	}
})

//-----------helper: get ONE random picture from the batch----------------\\
async function getRandomPhoto(query) {
	const response = await fetch(
		`https://scrappa.co/api/images?q=${encodeURIComponent(query)}`,
		{
			headers: {
				"x-api-key": process.env.API_KEY
			}
		}
	);

	console.log("API KEY EXISTS:", !!process.env.API_KEY);
	console.log("STATUS:", response.status);

	if (!response.ok) {
		throw new Error("Failed to get photos");
	}

	const data = await response.json();

	// the batch can come in different shapes, so find the list first
	const list = Array.isArray(data)
		? data
		: data.images || data.results || data.data || [];

	// pull the image link out of each item, skip items without one
	const urls = list
		.map(item =>
			typeof item === "string"
				? item
				: item.image_url || item.original || item.url || item.image || item.thumbnail
		)
		.filter(url => typeof url === "string" && url.startsWith("http"));

	if (urls.length === 0) {
		throw new Error("No pictures found");
	}

	// random pick: only one picture out of the batch
	return urls[Math.floor(Math.random() * urls.length)];
}

//-----------first search api sction----------------\\

app.get("/pick1/v1", async (req, res) => {
	const search = req.query.find1;
	if (typeof search !== "string" || !search.trim()) {
		console.log("the search is empty");
		return res.status(400).json({
			message: "the search is empty"
		});
	}

	try {
		const photo = await getRandomPhoto(search);

		res.json({
			photo1: photo,
			message: "Ready to buy? choose your device"
		});
	}
	catch (error) {
		console.error(error);
		res.status(500).json({
			message: "the is an error happening in search1 section"
		});
	}
})

//-----------2nd search api sction----------------\\

app.get("/pick2/v1", async (req, res) => {
	const search2 = req.query.find2;
	if (typeof search2 !== "string" || !search2.trim()) {
		console.log("the search is empty");
		return res.status(400).json({
			message: "the search is empty"
		});
	}

	try {
		const photo = await getRandomPhoto(search2);

		res.json({
			photo2: photo,
			message: "Ready to buy? choose your device"
		});
	}
	catch (error) {
		console.error(error);
		res.status(500).json({
			message: "There is an error in search2 section"
		});
	}
})

//=================1st AI Gemini======================//correct
app.get("/gemini1/v2", async(req,res)=>{

    const search1 = req.query.find1;
    const search2 = req.query.find2;

    try {

        const response = await fetch( `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key":process.env.GEMINI_API_KEY
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
						{
                           text: `${search1} vs ${search2} just send the ${search1} percentage first don't send anything just the comparison percentage of the first value according to the comparison only percentage don't say anything please the comparison must be between which of the project is better this is comparing app not other thing but although the result is like that only present one but in reality is too dont worry.now if the ${search1} does not relate to a device dont send anything.`
                        },
					
				]
                }]
            })
			}
        )
		
		 console.log("API KEY EXISTS:", !!process.env.GEMINI_API_KEY); 

        if (!response.ok) {
    const errorData = await response.json();
    console.log(errorData);
    throw new Error("the first ai is facing issues");
		}

        const data = await response.json();

        console.log(data.candidates[0].content.parts[0].text);
		res.json({
      percentage1:parseFloat(data.candidates[0].content.parts[0].text)
		})
		}
    catch(error) {
        console.error(error);
		res.status(500).json({
		message:"the is an error happening in gemini section"
		})
    }
})

//correct//
app.get("/gemini2/v2",async(req,res)=>{
	    const search1 = req.query.find1;
    const search2 = req.query.find2;

    try {

        const response = await fetch( `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key":process.env.GEMI2_API_KEY
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
						{
                           	text:`${search1} vs ${search2}. Just send ${search1}'s qualities. Don't send anything else, just a comparison list of the good and little disadvange and avantage comparing the other device dont say it's name qualities of the first value according to the comparison. Don't say anything else. This is for a comparison app, so even though the result should only present the first device, make sure the comparison is based on both devices. The text must have a debate-style tone, be short, reasonable, and easy to understand only focus on${search1} it must compare but result must be only ${search1} not ${search2} dont mention it only one only that . Keep the writing short but little long readeble ai add your own things too. vodacom text bellow too.can you also add prices section please can you add  prices at the bottom as last text  prices from vodacom.now if the i seached something that does not relate to a device like phone,laptop,watch and other devices please dont say anything to that search just say no data for search only that nothing else please dont say anything else`
                        },
					
				]
                }]
            })
			}
        )
		console.log("API KEY EXISTS:", !!process.env.GEMI2_API_KEY); 

        if (!response.ok) {
    const errorData = await response.json();
    console.log(errorData);
    throw new Error("this section Gemi2");

		}

        const data = await response.json();

        console.log(data.candidates[0].content.parts[0].text);
		
		res.json({
     column1:data.candidates[0].content.parts[0].text
		})
		}
		
    catch(error) {
        console.error(error);
		res.status(500).json({
		message:"the is an error happening in gemini2 section"
		})
    }
})

app.get("/gemini3/v2",async(req,res)=>{
	    const search1 = req.query.find1;
    const search2 = req.query.find2;

    try {

        const response = await fetch( `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key":process.env.GEMI3_API_KEY
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
						{
                           text: `${search1} vs ${search2} just send the ${search2} percentage first don't send anything just the comparison percentage of the first value according to the comparison only percentage don't say anything please the comparison must be between which of the project is better this is comparing app not other thing but although the result is like that only present one but in reality is too dont worry.now if the ${search2} does not relate to a device dont send anything.`
                        },
					
				]
                }]
            })
			}
        )
		console.log("API KEY EXISTS:", !!process.env.GEMI3_API_KEY); 

        if (!response.ok) {
    const errorData = await response.json();
    console.log(errorData);

    throw new Error("this section Gemi3");
		}

        const data = await response.json();

        console.log(data.candidates[0].content.parts[0].text);
		res.json({
      percentage2:parseFloat(data.candidates[0].content.parts[0].text)
		})
		}
    catch(error) {
        console.error(error);
		res.status(500).json({
		message:"the is an error happening in gemini3 section"
		})
    }
})

app.get("/gemini4/v2",async(req,res)=>{
	    const search1 = req.query.find1;
    const search2 = req.query.find2;

    try {

        const response = await fetch( `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key":process.env.GEMINI4_API_KEY
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
						{
							text:`${search1} vs ${search2}. Just send ${search2}'s qualities. Don't send anything else, just a comparison list of the good and little disadvange and avantage comparing the other device dont say it's name qualities of the first value according to the comparison. Don't say anything else. This is for a comparison app, so even though the result should only present the first device, make sure the comparison is based on both devices. The text must have a debate-style tone, be short, reasonable, and easy to understand only focus on${search2} it must compare but result must be only ${search2} not ${search1} dont mention it only one only that .but don't overuse them. Keep the writing short but little long readeble ai add your own things too. vodacom text bellow too.can you also add prices section please can you add  prices at the bottom as last text  prices from vodacom.now if the i seached something that does not relate to a device like phone,laptop,watch and other devices please dont say anything to that search just say no data for search only that nothing else please dont say anything else`
						},
				]
                }]
            })
			}
        )
        console.log("API KEY EXISTS:", !!process.env.GEMINI4_API_KEY);
		
        if (!response.ok) {
    const errorData = await response.json();
    console.log(errorData);
    throw new Error("this section in gemini4")

		}

        const data = await response.json();

        console.log(data.candidates[0].content.parts[0].text)
		
		res.json({
     column2:data.candidates[0].content.parts[0].text
		})
		}
		  catch(error) {
        console.error(error);
		res.status(500).json({
		message:"the is an error happening in gemini4 section"
		})
    }
})



app.listen(3000,()=>{
	console.log("Running on http://localhost3000");
})