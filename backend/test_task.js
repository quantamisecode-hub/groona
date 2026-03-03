const fs = require('fs');
const data = JSON.parse(fs.readFileSync('dbstore/Task.json', 'utf8'));
const completed = data.filter(t => t.status === 'completed');
console.log('Total completed tasks:', completed.length);
const assignees = {};
completed.forEach(t => {
    let a = Array.isArray(t.assigned_to) ? t.assigned_to : [t.assigned_to];
    a.forEach(user => {
        if (!user) user = 'UNASSIGNED';
        assignees[user] = (assignees[user] || 0) + 1;
    });
});
console.log('Assignees for completed tasks:', assignees);
