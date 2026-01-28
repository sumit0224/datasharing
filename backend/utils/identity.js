const adjectives = [
    'Mystic', 'Silent', 'Shadow', 'Azure', 'Crimson', 'Golden', 'Swift', 'Frost', 'Lunar', 'Solar',
    'Noble', 'Wild', 'Inner', 'Vibrant', 'Ethereal', 'Stormy', 'Ancient', 'Wandering', 'Hidden', 'Brave'
];

const animals = [
    'Fox', 'Tiger', 'Wolf', 'Owl', 'Panda', 'Eagle', 'Lion', 'Falcon', 'Raccoon', 'Coyote',
    'Leopard', 'Otter', 'Badger', 'Deer', 'Hawk', 'Raven', 'Bear', 'Lynx', 'Snake', 'Dragon'
];

function generateAnonymousName() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const num = Math.floor(Math.random() * 900) + 100; // 100-999
    return `${adj}${animal}_${num}`;
}

const colors = [
    '#667eea', '#764ba2', '#ff6b6b', '#4ecdc4', '#45b7d1',
    '#96ceb4', '#ffeead', '#ffcc5c', '#ff6f69', '#d4a5a5'
];

function getRandomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}

module.exports = {
    generateAnonymousName,
    getRandomColor
};
