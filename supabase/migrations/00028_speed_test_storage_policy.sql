-- Allow authenticated users to upload speed test screenshots
CREATE POLICY "Allow authenticated uploads to speed-tests" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'speed-tests');

CREATE POLICY "Allow authenticated reads from speed-tests" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'speed-tests');
