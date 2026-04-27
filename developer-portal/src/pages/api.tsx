import React from 'react';
import Layout from '@theme/Layout';

export default function ApiReference() {
  return (
    <Layout title="API Reference" description="Food Delivery API Documentation">
      <iframe src="/api.html" style={{ width: '100%', height: 'calc(100vh - 60px)', border: 'none' }} />
    </Layout>
  );
}
