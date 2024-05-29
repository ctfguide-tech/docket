/*
(C) CTFGuide Corporation 2024
Authored by Pranav Ramesh
*/

// Import TensorFlow.js
import * as tf from '@tensorflow/tfjs';

// TODO: Add endpoints for each node that can communicate back this information.
const serverData = [
  { node: 1, cpuUsage: 0.5, memoryUsage: 0.6, diskUsage: 0.4 },
  { node: 2, cpuUsage: 0.3, memoryUsage: 0.4, diskUsage: 0.5 },
  { node: 3, cpuUsage: 0.7, memoryUsage: 0.8, diskUsage: 0.7 },
];

// Prepare data for TensorFlow
const inputs = serverData.map(server => [server.cpuUsage, server.memoryUsage, server.diskUsage]);
const outputs = serverData.map(server => server.node);

// Convert data to tensors
const inputTensor = tf.tensor2d(inputs);
const outputTensor = tf.tensor1d(outputs, 'float32');

// Build and train the model
const model = tf.sequential();
model.add(tf.layers.dense({ inputShape: [3], units: 8, activation: 'relu' }));
model.add(tf.layers.dense({ units: 3, activation: 'softmax' }));

model.compile({
  optimizer: 'adam',
  loss: 'sparseCategoricalCrossentropy',
  metrics: ['accuracy']
});

async function trainModel() {
  await model.fit(inputTensor, outputTensor, {
    epochs: 50,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch + 1}: loss = ${logs.loss}`);
      }
    }
  });
}

// Train the model
trainModel().then(() => {
  console.log('Model training complete');

  // predict best node
  function predictNode(cpuUsage, memoryUsage, diskUsage) {
    const prediction = model.predict(tf.tensor2d([[cpuUsage, memoryUsage, diskUsage]]));
    const predictedNode = prediction.argMax(1).dataSync()[0];
    return predictedNode;
  }

  // Prediction
  const newContainer = { cpuUsage: 0.4, memoryUsage: 0.5, diskUsage: 0.3 };
  const bestNode = predictNode(newContainer.cpuUsage, newContainer.memoryUsage, newContainer.diskUsage);
  console.log(`Optimal Node Placement found @ Node ${bestNode}`);
});
