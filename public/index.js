let transactions = []
let myChart
let db
const request = indexedDB.open('transactDB', 1)

const checkDatabase = () => {
  const transaction = db.transaction(['transaction'], 'readwrite')
  const store = transaction.objectStore('transaction')

  const getAll = store.getAll()

  getAll.onsuccess = () => {
    if (getAll.result.length > 0) {
      axios.post('/api/transaction/bulk', getAll.result)
        .then(() => {
          const transaction = db.transaction(['transaction'], 'readwrite')
          const store = transaction.objectStore('transaction')
          store.clear()
          populateTotal()
          populateTable()
          populateChart()
        })
    }
  }
}

const saveRecord = item => {
  const transaction = db.transaction(['transaction'], 'readwrite')
  const store = transaction.objectStore('transaction')
  store.add(item)
}

request.onupgradeneeded = event => {
  db = event.target.result
  const objectStore = db.createObjectStore('transaction', { autoIncrement: true })
  objectStore.createIndex('transaction', 'transaction')
}

request.onsuccess = event => {
  db = event.target.result
  if (navigator.onLine) {
    checkDatabase()
  }
}

request.onerror = event => {
  console.log('db error')
}

fetch('/api/transaction')
  .then(response => {
    return response.json()
  })
  .then(data => {
    // save db data on global variable
    transactions = data

    populateTotal()
    populateTable()
    populateChart()
  })
  .catch(err => {
    console.log(err)
    // fetch failed, so save in indexed db
  })

function populateTotal () {
  // reduce transaction amounts to a single total value
  const total = transactions.reduce((total, t) => {
    return total + parseInt(t.value)
  }, 0)

  const totalEl = document.querySelector('#total')
  totalEl.textContent = total
}

function populateTable () {
  const tbody = document.querySelector('#tbody')
  tbody.innerHTML = ''

  transactions.forEach(transaction => {
    // create and populate a table row
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `

    tbody.appendChild(tr)
  })
}

function populateChart () {
  // copy array and reverse it
  const reversed = transactions.slice().reverse()
  let sum = 0

  // create date labels for chart
  const labels = reversed.map(t => {
    const date = new Date(t.date)
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
  })

  // create incremental values for chart
  const data = reversed.map(t => {
    sum += parseInt(t.value)
    return sum
  })

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy()
  }

  const ctx = document.getElementById('myChart').getContext('2d')

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Total Over Time',
        fill: true,
        backgroundColor: '#6666ff',
        data
      }]
    }
  })
}

function sendTransaction (isAdding) {
  const nameEl = document.querySelector('#t-name')
  const amountEl = document.querySelector('#t-amount')
  const errorEl = document.querySelector('.form .error')

  // validate form
  if (nameEl.value === '' || amountEl.value === '') {
    errorEl.textContent = 'Missing Information'
    return
  } else {
    errorEl.textContent = ''
  }

  // create record
  const transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  }

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1
  }

  // add to beginning of current array of data
  transactions.unshift(transaction)

  // re-run logic to populate ui with new record
  populateChart()
  populateTable()
  populateTotal()

  // also send to server
  fetch('/api/transaction', {
    method: 'POST',
    body: JSON.stringify(transaction),
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json'
    }
  })
    .then(response => {
      return response.json()
    })
    .then(data => {
      if (data.errors) {
        errorEl.textContent = 'Missing Information'
      } else {
      // clear form
        nameEl.value = ''
        amountEl.value = ''
      }
    })
    .catch(err => {
      console.log(err)
      // fetch failed, so save in indexed db
      saveRecord(transaction)

      // clear form
      nameEl.value = ''
      amountEl.value = ''
    })
}

document.querySelector('#add-btn').onclick = function () {
  sendTransaction(true)
}

document.querySelector('#sub-btn').onclick = function () {
  sendTransaction(false)
}
