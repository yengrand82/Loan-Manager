#!/bin/bash
APP_FILE="src/App.js"

echo "🔍 Checking for parseLocalDate function..."
if ! grep -q "const parseLocalDate" "$APP_FILE"; then
    echo "❌ ERROR: parseLocalDate not found"
    exit 1
fi

echo "✅ parseLocalDate found!"
echo "🔧 Fixing date parsing bugs..."
echo ""

cp "$APP_FILE" "${APP_FILE}.backup"
TOTAL=0

fix_pattern() {
    local old="$1"
    local new="$2"
    local count=$(grep -c "$old" "$APP_FILE" 2>/dev/null || echo "0")
    if [ "$count" -gt 0 ]; then
        sed -i '' "s/$old/$new/g" "$APP_FILE"
        echo "  ✅ Fixed $count: $old"
        TOTAL=$((TOTAL + count))
    fi
}

fix_pattern "new Date(nextDue\.dueDate)" "parseLocalDate(nextDue.dueDate)"
fix_pattern "new Date(nextPayment\.dueDate)" "parseLocalDate(nextPayment.dueDate)"
fix_pattern "new Date(payment\.dueDate)" "parseLocalDate(payment.dueDate)"
fix_pattern "new Date(payment\.paymentdate)" "parseLocalDate(payment.paymentdate)"
fix_pattern "new Date(paymentRecord\.paymentdate)" "parseLocalDate(paymentRecord.paymentdate)"
fix_pattern "new Date(pendingPayment\.paymentdate)" "parseLocalDate(pendingPayment.paymentdate)"
fix_pattern "new Date(msg\.timestamp)" "parseLocalDate(msg.timestamp)"
fix_pattern "new Date(app\.timestamp)" "parseLocalDate(app.timestamp)"
fix_pattern "new Date(loan\.startdate)" "parseLocalDate(loan.startdate)"
fix_pattern "new Date(borrower\.createddate)" "parseLocalDate(borrower.createddate)"

echo ""
echo "🎉 Fixed $TOTAL bugs total!"
