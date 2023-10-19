const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)
const {Op} = require('sequelize')

/**
 * FIX ME!w
 * @returns contract by id
 */

app.get('/contracts' ,async (req, res) =>{
    const {Contract} = req.app.get('models')
    const {id} = req.params
    const contract = await Contract.findAll({where: {status: {[Op.ne] : "terminated"}}})
    
    if(!contract) return res.status(404).end()
    res.json(contract)
})

app.get('/contracts/:id' ,getProfile, async (req, res) =>{
    const {Contract} = req.app.get('models')
    const {id} = req.params
    const contract = await Contract.findOne({where: {id}})
    if(!contract) return res.status(404).end()
    res.json(contract)
})


//**_GET_** `/jobs/unpaid` - Get all unpaid jobs for a user (**_either_** a client or contractor), for **_active contracts only_**. 
//select 

app.get('/jobs/unpaid', async (req, res) =>{
    const {Job, Contract, Profile} = req.app.get('models')
        const jobs = await Job.findAll({
        where: {paid: {[Op.or]: [false, null]}},
        include: [
            {
                model: Contract,
                where: {status: 'in_progress'},
                include: [
                    {
                        model: Profile,
                        as: 'Client'
                    },
                    {
                        model: Profile,
                        as: 'Contractor'
                    }
                ]
            }
        ]
    })
    if(!jobs) return res.status(404).end()
    res.json(jobs)

})

// **_POST_** `/jobs/:job_id/pay` - Pay for a job, a client can only pay if his balance >= the amount to pay. The amount should be moved from the client's balance to the contractor balance.

app.post('/jobs/:job_id/pay', async (req, res) =>{
    const {Job, Profile} = req.app.get('models')
    const {job_id} = req.params
    const job = await Job.findOne({where: {id: job_id}})
    const client = await Profile.findOne({where: {id: job.clientId, balance: {[Op.gte]: job.price}}});
    if (!client) return res.status(404).end()
    const contractor = await Profile.findOne({where: {id: job.contractorId}})
    if(!job) return res.status(404).end()
    if(client.balance < job.price) return res.status(404).end()
    const newBalanceClient = client.balance - job.price
    const newBalanceContractor = contractor.balance + job.price
    await client.update({balance: newBalanceClient})
    await contractor.update({balance: newBalanceContractor})
    await job.update({paid: true, paymentDate: new Date()})
    res.json(job)
});

//1. **_POST_** `/balances/deposit/:userId` - Deposits money into the the the balance of a client, a client can't deposit more than 25% his total of jobs to pay. (at the deposit moment)
app.post('/balances/deposit/:userId', async (req, res) =>{
    const {Profile} = req.app.get('models')
    const {userId} = req.params
    const {amount} = req.body
    const user = await Profile.findOne({where: {id: userId}})
    if(!user) return res.status(404).end()
    const maxDeposit = user.balance * 0.25
    if(amount > maxDeposit) return res.status(404).end()
    const newBalance = user.balance + amount
    await user.update({balance: newBalance})
    res.json(user)
});

//1. **_GET_** `/admin/best-profession?start=<date>&end=<date>` - Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range.
app.get('/admin/best-profession', async (req, res) => {
    const { Profile, Job } = req.app.get('models');
    const { start, end } = req.query;
    if (!start || !end) return res.status(404).end();
  
    const jobs = await Job.findAll({
        
      where: {
        paymentDate: {
          [Op.between]: [start, end]
        },
        paid: true
      },
      include: [
        {
          model: Profile,
          as: 'Contractor'
        }
      ]
    });
  
    if (!jobs || !jobs.length) return res.status(404).end();
  
    const contractors = {};
    jobs.forEach(job => {
      if (!contractors[job.Contractor.profession]) {
        contractors[job.Contractor.profession] = job.price;
      } else {
        contractors[job.Contractor.profession] += job.price;
      }
    });
  
    const bestProfession = Object.keys(contractors).reduce((a, b) =>
      contractors[a] > contractors[b] ? a : b
    );
  
    res.json({ bestProfession });
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
app.get('/admin/best-clients', async (req, res) =>{
    const {Profile, Job} = req.app.get('models')
    const {start, end, limit} = req.query
    const jobs = await Job.findAll({
        where: {
            paymentDate: {
                [Op.between]: [start, end]
            }
        },
        
        include: [
            {
                model: Profile,
                as: 'Client'
            }
        ]
    })
    if(!jobs) return res.status(404).end()
    const clients = {}
    jobs.forEach(job => {
        if(!clients[job.Client.id]){
            clients[job.Client.id] = job.price
        }else{
            clients[job.Client.id] += job.price
        }
    })
    const bestClients = Object.keys(clients).reduce((a, b) => clients[a] > clients[b] ? a : b);
    res.json({bestClients})
});



module.exports = app;
