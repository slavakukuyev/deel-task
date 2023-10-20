const express = require('express');
const bodyParser = require('body-parser');
const {
    sequelize
} = require('./model')
const {
    getProfile
} = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

const {
    Op,
} = require('sequelize')

/**
 * FIX ME!w
 * @returns contract by id
 */

app.get('/contracts', async (req, res) => {
    const {
        Contract,
    } = req.app.get('models')
    const contract = await Contract.findAll({
        where: {
            status: {
                [Op.ne]: "terminated"
            }
        }
    })
    if (!contract) return res.status(404).end()
    res.json(contract)
})

app.get('/contracts/:id', getProfile, async (req, res) => {
    const {
        Contract
    } = req.app.get('models')
    const {
        id
    } = req.params
    const contract = await Contract.findOne({
        where: {
            id
        }
    })
    if (!contract) return res.status(404).end()
    res.json(contract)
})


//**_GET_** `/jobs/unpaid` - Get all unpaid jobs for a user (**_either_** a client or contractor), for **_active contracts only_**. 
//select 

app.get('/jobs/unpaid', async (req, res) => {
    const {
        Job,
        Contract,
        Profile
    } = req.app.get('models')
    const jobs = await Job.findAll({
        where: {
            paid: {
                [Op.or]: [false, null]
            }
        },
        include: [{
            model: Contract,
            where: {
                status: 'in_progress'
            },
            include: [{
                    model: Profile,
                    as: 'Client'
                },
                {
                    model: Profile,
                    as: 'Contractor'
                }
            ]
        }]
    })
    if (!jobs) return res.status(404).end()
    res.json(jobs)

})

// **_POST_** `/jobs/:job_id/pay` - Pay for a job, a client can only pay if his balance >= the amount to pay. The amount should be moved from the client's balance to the contractor balance.

//!!!!!!  There is no Id for job in the model   !!!!!!!!!!!!!!!!!!!!!!


// app.post('/jobs/:job_id/pay', async (req, res) => {
//     const {
//         Job,
//         Profile
//     } = req.app.get('models')
//     const {
//         job_id
//     } = req.params
//     try {
//         const job = await Job.findOne({
//             where: {
//                 id: job_id
//             }
//         })
//         if (!job) return res.status(404).end()
//         const client = await Profile.findOne({
//             where: {
//                 id: job.clientId,
//                 balance: {
//                     [Op.gte]: job.price
//                 }
//             }
//         });
//         if (!client) return res.status(404).json({
//             error: "Client not found or insufficient balance"
//         }).end()
//         const contractor = await Profile.findOne({
//             where: {
//                 id: job.contractorId
//             }
//         })
//         if (!job) return res.status(404).json({
//             error: "Job not found"
//         }).end()
//         if (client.balance < job.price) return res.status(404).json({
//             error: "Insufficient balance"
//         }).end()
//         const newBalanceClient = client.balance - job.price
//         const newBalanceContractor = contractor.balance + job.price
//         await client.update({
//             balance: newBalanceClient
//         })
//         await contractor.update({
//             balance: newBalanceContractor
//         })
//         await job.update({
//             paid: true,
//             paymentDate: new Date()
//         })
//         res.json(job)
//     } catch (error) {
//         console.error(error);
//         res.status(500).end();
//     }
// });

//1. **_POST_** `/balances/deposit/:userId` - Deposits money into the the the balance of a client, a client can't deposit more than 25% his total of jobs to pay. (at the deposit moment)
app.post('/balances/deposit/:userId', async (req, res) => {
    const {
        Profile
    } = req.app.get('models')
    const {
        userId
    } = req.params
    const {
        amount
    } = req.body
    const user = await Profile.findOne({
        where: {
            id: userId
        }
    })
    if (!user) return res.status(404).end()
    const maxDeposit = user.balance * 0.25
    if (amount > maxDeposit) return res.status(404).end()
    const newBalance = user.balance + amount
    await user.update({
        balance: newBalance
    })
    res.json(user)
});

//1. **_GET_** `/admin/best-profession?start=<date>&end=<date>` - Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range.
//job has a contract and contract has a contractor or client
app.get('/admin/best-profession', async (req, res) => {
    const {
        Profile,
        Job,
        Contract,
        sequelize,
    } = req.app.get('models')
    const {
        start,
        end
    } = req.query
    if (!start || !end) return res.status(404).end();



    const jobs = await Job.findAll({
        where: {
            paymentDate: {
                [Op.between]: [start, end]
            }
        },

        include: [{
            model: Contract,
            include: [{
                model: Profile,
                as: 'Contractor'
            }]
        }]
    })
    if (!jobs || !jobs.length) return res.status(404).json({error: "No Jobs found between provided dates"}).end()
    const professions = {}
    jobs.forEach(job => {
        if (!professions[job.Contract.Contractor.profession]) {
            professions[job.Contract.Contractor.profession] = job.price
        } else {
            professions[job.Contract.Contractor.profession] += job.price
        }
    })
    if (Object.keys(professions).length === 0) return res.status(404).json({
        error: "No contracts found in this time period"
    }).end();

    const bestProfession = Object.keys(professions).reduce((a, b) => professions[a] > professions[b] ? a : b);
    res.json({
        bestProfession
    })

});

/**
 * 1. **_GET_** `/admin/best-clients?start=<date>&end=<date>&limit=<integer>` - returns the clients the paid the most for jobs in the query time period. limit query parameter should be applied, default limit is 2.

```
[
   {
       "id": 1,
       "fullName": "Reece Moyer",
       "paid" : 100.3
   },
   {
       "id": 200,
       "fullName": "Debora Martin",
       "paid" : 99
   },
   {
       "id": 22,
       "fullName": "Debora Martin",
       "paid" : 21
   }
]
```
 */
app.get('/admin/best-clients', async (req, res) => {
    const {
        Profile,
        Job,
        Contract,
    } = req.app.get('models')
    const {
        start,
        end,
        limit
    } = req.query

    if (!start || !end) return res.status(404).json({error: "No dates provided"}).end();


    const jobs = await Job.findAll({
        where: {
            paymentDate: {
                [Op.between]: [start, end]
            }
        },

        include: [{
            model: Contract,
            include: [{          
                model: Profile,
                as: 'Client',
             
            }]

        }],
    })
    if (!jobs || !jobs.length) return res.status(404).json({error: "No jobs found"}).end()
    const clients = {}
    jobs.forEach(job => {
        let clientFullName = job.Contract.Client.firstName + " " + job.Contract.Client.lastName
        if (!clients[clientFullName]) {
            clients[clientFullName] = job.price
        } else {
            clients[clientFullName] += job.price
        }
    })
    if (Object.keys(clients).length === 0) return res.status(404).json({error: "Clients is empty"}).end();

   //return clients with highest paid jobs . use limit query parameter
    const sortedClients = Object.keys(clients).sort((a, b) => clients[b] - clients[a]).slice(0, limit || 2)
    return sortedClients.length ? res.json(sortedClients) : res.status(404).json({error: "No clients found"}).end()
});



module.exports = app;