for i in {0..3000..500}
do
  echo "Processing skip=$i limit=500..."
  curl -s "http://localhost:3000/api/dev/migrate-wholesale-costs?skip=$i&limit=500"
  echo ""
done
